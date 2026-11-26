import { NextResponse } from 'next/server'
import type { AccountBase, RemovedTransaction } from 'plaid/legacy'

import { plaidClient, requireUser, plaidErrorMessage, mapAccountType } from '@/lib/plaid'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Refreshes balances and pulls new transactions for every live connection.
 *
 * Transactions come from /transactions/sync, which is cursor-based: each call
 * resumes where the last one stopped and reports what was added, changed and
 * removed since. The cursor is only written back once the rows it covers are
 * stored, so a failure part-way through repeats that page rather than skipping it.
 *
 * Amounts are flipped. Plaid reports money leaving the account as positive;
 * bank_transactions is signed with negative for money out, which is the
 * convention the rest of the dashboard reads.
 */
export async function POST() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const plaid = plaidClient()
  const admin = createAdminClient()

  const { data: items, error: itemsErr } = await admin
    .from('plaid_items')
    .select('id, item_id, access_token, transactions_cursor, institution_name')
    .eq('status', 'active')
  if (itemsErr) {
    console.error('plaid/sync: loading items:', itemsErr.message)
    return NextResponse.json({ error: 'Could not load connections.' }, { status: 500 })
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ items: 0, accounts: 0, added: 0, removed: 0, errors: [] })
  }

  let accountsUpdated = 0
  let added = 0
  let removed = 0
  const errors: string[] = []

  for (const item of items) {
    const label = item.institution_name || item.item_id
    try {
      // --- balances -------------------------------------------------------
      const balances = await plaid.accountsBalanceGet({ access_token: item.access_token })
      const now = new Date().toISOString()
      const accountRows = balances.data.accounts.map((a: AccountBase) => ({
        name: a.name || a.official_name || 'Account',
        institution: item.institution_name,
        mask: a.mask || null,
        account_type: mapAccountType(a.type, a.subtype),
      account_subtype: a.subtype || null,
        current_balance: a.balances.current ?? 0,
        available_balance: a.balances.available ?? null,
        currency: a.balances.iso_currency_code || 'USD',
        balance_as_of: now,
        source: 'plaid',
        external_id: a.account_id,
        plaid_item_id: item.id,
        updated_at: now,
      }))
      if (accountRows.length > 0) {
        const { error } = await admin.from('bank_accounts').upsert(accountRows, { onConflict: 'external_id' })
        if (error) throw error
        accountsUpdated += accountRows.length
      }

      // Plaid account_id -> our bank_accounts.id, for the transaction rows.
      const { data: mapped, error: mapErr } = await admin
        .from('bank_accounts')
        .select('id, external_id')
        .eq('plaid_item_id', item.id)
      if (mapErr) throw mapErr
      const accountIdByExternal = new Map((mapped || []).map((m: any) => [m.external_id, m.id]))

      // --- transactions ---------------------------------------------------
      let cursor: string | undefined = item.transactions_cursor || undefined
      let hasMore = true
      let guard = 0

      while (hasMore && guard < 50) {
        guard += 1
        const page = await plaid.transactionsSync({
          access_token: item.access_token,
          cursor,
          count: 500,
        })
        const d = page.data

        const upserts = [...d.added, ...d.modified]
          .map((t) => {
            const accountId = accountIdByExternal.get(t.account_id)
            if (!accountId) return null
            return {
              account_id: accountId,
              date: t.date,
              // Plaid: positive is money out. Ours: negative is money out.
              amount: -(t.amount ?? 0),
              description: t.merchant_name || t.name || null,
              category: t.personal_finance_category?.primary || null,
              pending: Boolean(t.pending),
              source: 'plaid',
              external_id: t.transaction_id,
            }
          })
          .filter(Boolean) as any[]

        if (upserts.length > 0) {
          const { error } = await admin.from('bank_transactions').upsert(upserts, { onConflict: 'external_id' })
          if (error) throw error
          added += d.added.length
        }

        if (d.removed.length > 0) {
          const ids = d.removed.map((r: RemovedTransaction) => r.transaction_id)
          const { error } = await admin.from('bank_transactions').delete().in('external_id', ids)
          if (error) throw error
          removed += ids.length
        }

        cursor = d.next_cursor
        hasMore = d.has_more

        // Written only after this page is stored, so a crash repeats the page
        // instead of stepping over transactions that were never saved.
        const { error: curErr } = await admin
          .from('plaid_items')
          .update({ transactions_cursor: cursor, last_synced_at: new Date().toISOString(), last_error: null })
          .eq('id', item.id)
        if (curErr) throw curErr
      }
    } catch (err: any) {
      const msg = plaidErrorMessage(err)
      console.error(`plaid/sync: ${label}:`, msg)
      errors.push(`${label}: ${msg}`)
      // ITEM_LOGIN_REQUIRED means the bank wants the user to sign in again; mark
      // it so the dashboard can say so instead of silently serving a stale figure.
      const needsLogin = /ITEM_LOGIN_REQUIRED/i.test(msg)
      await admin
        .from('plaid_items')
        .update({ status: needsLogin ? 'login_required' : 'error', last_error: msg })
        .eq('id', item.id)
    }
  }

  return NextResponse.json({ items: items.length, accounts: accountsUpdated, added, removed, errors })
}

