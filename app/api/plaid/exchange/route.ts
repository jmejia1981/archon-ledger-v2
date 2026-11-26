import { NextResponse } from 'next/server'
import { CountryCode, type AccountBase } from 'plaid/legacy'

import { plaidClient, requireUser, plaidErrorMessage } from '@/lib/plaid'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Turns the one-time public token Link returns into a lasting access token, and
 * records the accounts behind it.
 *
 * The access token is written through the service role into plaid_items, which no
 * browser key can read, and is never included in the response. The client learns
 * only how many accounts were linked.
 */
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let publicToken: string | undefined
  try {
    publicToken = (await request.json())?.public_token
  } catch {
    return NextResponse.json({ error: 'Expected JSON with a public_token.' }, { status: 400 })
  }
  if (!publicToken) return NextResponse.json({ error: 'Missing public_token.' }, { status: 400 })

  const plaid = plaidClient()
  const admin = createAdminClient()

  try {
    const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken })
    const accessToken = exchange.data.access_token
    const itemId = exchange.data.item_id

    let institutionId: string | null = null
    let institutionName: string | null = null
    try {
      const item = await plaid.itemGet({ access_token: accessToken })
      institutionId = item.data.item.institution_id || null
      if (institutionId) {
        const inst = await plaid.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        })
        institutionName = inst.data.institution.name
      }
    } catch {
      // The institution name is a nicety. Losing it must not lose the connection.
    }

    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .upsert(
        {
          item_id: itemId,
          access_token: accessToken,
          institution_id: institutionId,
          institution_name: institutionName,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'item_id' },
      )
      .select('id')
      .single()
    if (itemErr) throw itemErr

    // Record the accounts straight away so the dashboard has something to show
    // before the first transaction sync finishes.
    const balances = await plaid.accountsBalanceGet({ access_token: accessToken })
    const now = new Date().toISOString()
    const rows = balances.data.accounts.map((a: AccountBase) => ({
      name: a.name || a.official_name || 'Account',
      institution: institutionName,
      mask: a.mask || null,
      account_type: mapType(a.type, a.subtype),
      current_balance: a.balances.current ?? 0,
      available_balance: a.balances.available ?? null,
      currency: a.balances.iso_currency_code || 'USD',
      balance_as_of: now,
      source: 'plaid',
      external_id: a.account_id,
      plaid_item_id: item.id,
      is_active: true,
      updated_at: now,
    }))

    if (rows.length > 0) {
      const { error: accErr } = await admin
        .from('bank_accounts')
        .upsert(rows, { onConflict: 'external_id' })
      if (accErr) throw accErr
    }

    return NextResponse.json({ linked: rows.length, institution: institutionName })
  } catch (err: any) {
    console.error('plaid/exchange:', plaidErrorMessage(err))
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 502 })
  }
}

/** Plaid's type/subtype onto the five this schema allows. */
function mapType(type: string, subtype: string | null | undefined): string {
  if (type === 'depository') return subtype === 'savings' ? 'savings' : 'checking'
  if (type === 'credit') return 'credit'
  if (type === 'loan') return 'loan'
  return 'other'
}
