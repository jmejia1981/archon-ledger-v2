import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/plaid'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface BookItem {
  id: string
  vendor?: string
  taxCategory: string
  group: string
  projectId?: string | null
}

/**
 * Books a batch of bank lines as expenses.
 *
 * The single-row path in the page does the same thing one at a time. This exists
 * because the queue is full of the same merchant repeated — 23 fuel stops, 18
 * rides — and a tool that makes a person click 23 times to say one thing invites
 * them to stop reconciling altogether.
 *
 * Two rules keep it from double-booking:
 *
 *   The set is re-read here and anything already decided is dropped. The browser's
 *   idea of what is unreviewed can be stale — another tab, an earlier click, a
 *   re-run of auto-match — and trusting it would book a cost twice.
 *
 *   Each new expense is linked back to the line that produced it before this
 *   returns, so the line leaves the queue and cannot be offered again.
 *
 * Pending lines are refused outright. The amount can still change.
 */
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let items: BookItem[]
  try {
    items = (await request.json())?.items
  } catch {
    return NextResponse.json({ error: 'Expected JSON with an items array.' }, { status: 400 })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Nothing to book.' }, { status: 400 })
  }
  if (items.some((i) => !i?.id || !i?.taxCategory)) {
    return NextResponse.json(
      { error: 'Every line needs a Schedule C category before it can be booked.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Re-read rather than trust the client. Anything already decided is skipped,
  // which is what stops a stale page from booking a cost a second time.
  const { data: txs, error: txErr } = await admin
    .from('bank_transactions')
    .select('id, date, amount, description, pending, matched_kind')
    .in('id', items.map((i) => i.id))
  if (txErr) {
    console.error('reconcile/book: loading transactions:', txErr.message)
    return NextResponse.json({ error: 'Could not load those transactions.' }, { status: 500 })
  }

  const byId = new Map((txs || []).map((t: any) => [t.id, t]))
  const bookable: { item: BookItem; tx: any }[] = []
  let skipped = 0
  for (const item of items) {
    const tx = byId.get(item.id)
    if (!tx || tx.matched_kind || tx.pending || Number(tx.amount) >= 0) {
      skipped += 1
      continue
    }
    bookable.push({ item, tx })
  }
  if (bookable.length === 0) {
    return NextResponse.json({ booked: 0, skipped, total: 0 })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const expenseRows = bookable.map(({ item, tx }) => ({
    date: tx.date,
    vendor: item.vendor || tx.description || 'Unknown',
    amount: Math.abs(Number(tx.amount)),
    category_group: item.group,
    category: 'General',
    tax_category: item.taxCategory,
    project_id: item.projectId || null,
    payment_status: 'paid',
    description: tx.description,
    notes: `Reconciled from bank feed on ${stamp}.`,
  }))

  // Inserted in one statement; PostgREST returns the new rows in the order sent,
  // which is what lets each one be paired back to the line it came from.
  const { data: created, error: insErr } = await admin
    .from('expenses')
    .insert(expenseRows)
    .select('id')
  if (insErr) {
    console.error('reconcile/book: inserting expenses:', insErr.message)
    return NextResponse.json({ error: `Could not create the expenses: ${insErr.message}` }, { status: 500 })
  }
  if (!created || created.length !== bookable.length) {
    // Without a reliable pairing the links would be guesswork, and a wrong link
    // is worse than none: it would point an audit at the wrong cost.
    console.error('reconcile/book: expected', bookable.length, 'rows back, got', created?.length)
    return NextResponse.json(
      {
        error:
          `Created ${created?.length ?? 0} expenses but could not link them back to their bank lines. ` +
          `Check the expenses page before booking these again.`,
      },
      { status: 500 },
    )
  }

  const now = new Date().toISOString()
  const links = bookable.map(({ tx }, i) => ({
    id: tx.id,
    account_id: tx.account_id,
    date: tx.date,
    amount: tx.amount,
    matched_kind: 'expense',
    matched_id: created[i].id,
    matched_at: now,
    matched_note: 'Expense created from this line during reconciliation.',
  }))

  // account_id is not in the select above; fetch it for the upsert, which needs
  // every not-null column to build a valid row.
  const { data: full, error: fullErr } = await admin
    .from('bank_transactions')
    .select('id, account_id')
    .in('id', links.map((l) => l.id))
  if (fullErr) {
    console.error('reconcile/book: loading account ids:', fullErr.message)
    return NextResponse.json({ error: 'Expenses were created but could not be linked.' }, { status: 500 })
  }
  const accountById = new Map((full || []).map((f: any) => [f.id, f.account_id]))
  for (const l of links) l.account_id = accountById.get(l.id)

  const { error: linkErr } = await admin
    .from('bank_transactions')
    .upsert(links, { onConflict: 'id' })
  if (linkErr) {
    console.error('reconcile/book: linking:', linkErr.message)
    return NextResponse.json(
      { error: `Expenses were created but not linked: ${linkErr.message}. Do not book these again.` },
      { status: 500 },
    )
  }

  return NextResponse.json({ booked: bookable.length, skipped, total: items.length })
}
