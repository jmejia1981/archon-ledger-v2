import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/plaid'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Days either side of a bank line that a booked record may still be the same event. */
const EXPENSE_WINDOW = 3
const BILL_WINDOW = 7

/** Plaid's categories for money moving rather than being spent. */
const TRANSFER_CATEGORIES = new Set(['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'])

/** Rows per write. Large enough to keep this to a few round trips, small enough to stay well inside request limits. */
const CHUNK = 200

const dayGap = (a: string, b: string) =>
  Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000)

interface Candidate {
  id: string
  date: string
  amount: number
}

/**
 * Marks every bank line that already corresponds to something in the books.
 *
 * This writes no expenses. It only records what a line *is*, so the review queue
 * can show what is genuinely unaccounted for instead of asking about costs that
 * were entered weeks ago.
 *
 * The matching is strictly one-to-one. Six identical $500 payments to the same
 * subcontractor are six real events, and a naive `amount = amount` join would let
 * one bank line claim all six — reporting everything reconciled while five
 * payments silently vanished from the queue. Each booked record is consumed by at
 * most one bank line, and each bank line takes at most one record.
 *
 * Order matters. A booked record is checked for before the feed's own category,
 * because a vendor bill settled by bank transfer arrives labelled TRANSFER_OUT:
 * testing the category first would file a real bill payment as "money moved",
 * which excludes it from the queue under the wrong name and hides it from any
 * later question about what that bill was actually paid against.
 *
 * Pending lines are never matched. The amount can still change, and a match made
 * against a figure that later moves is worse than no match.
 *
 * Idempotent. Lines already decided are left exactly as they are, so a human
 * judgement is never overwritten by a re-run.
 */
export async function POST() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient()

  const { data: txs, error: txErr } = await admin
    .from('bank_transactions')
    .select('id, account_id, date, amount, description, category, pending')
    .is('matched_kind', null)
    .eq('pending', false)
    .order('date', { ascending: true })
  if (txErr) {
    console.error('reconcile/auto-match: loading transactions:', txErr.message)
    return NextResponse.json({ error: 'Could not load bank transactions.' }, { status: 500 })
  }
  if (!txs?.length) {
    return NextResponse.json({ written: 0, transfers: 0, expenses: 0, bills: 0, remaining: 0 })
  }

  // Records already claimed by an earlier run must not be offered again.
  const { data: taken, error: takenErr } = await admin
    .from('bank_transactions')
    .select('matched_id')
    .not('matched_id', 'is', null)
  if (takenErr) {
    console.error('reconcile/auto-match: loading existing matches:', takenErr.message)
    return NextResponse.json({ error: 'Could not read existing matches.' }, { status: 500 })
  }
  const claimed = new Set((taken || []).map((t: any) => t.matched_id))

  const [expensesRes, billsRes] = await Promise.all([
    admin.from('expenses').select('id, date, amount'),
    admin.from('vendor_bills').select('id, issue_date, amount'),
  ])
  // Checked explicitly: a silent failure here would report "nothing matched a
  // bill" when the truth is that the bills were never read.
  if (expensesRes.error || billsRes.error) {
    const why = expensesRes.error?.message || billsRes.error?.message
    console.error('reconcile/auto-match: loading booked records:', why)
    return NextResponse.json({ error: 'Could not read the existing books.' }, { status: 500 })
  }

  const freeExpenses: Candidate[] = (expensesRes.data || [])
    .filter((e: any) => !claimed.has(e.id))
    .map((e: any) => ({ id: e.id, date: e.date, amount: Number(e.amount) }))
  const freeBills: Candidate[] = (billsRes.data || [])
    .filter((b: any) => !claimed.has(b.id))
    .map((b: any) => ({ id: b.id, date: b.issue_date, amount: Number(b.amount) }))

  // Consumed here, so one record can never satisfy two bank lines.
  const usedExpense = new Set<string>()
  const usedBill = new Set<string>()

  const take = (pool: Candidate[], used: Set<string>, outflow: number, date: string, window: number) => {
    let best: Candidate | null = null
    let bestGap = Infinity
    for (const c of pool) {
      if (used.has(c.id)) continue
      if (!c.date) continue
      if (Math.abs(c.amount - outflow) > 0.005) continue
      const gap = dayGap(c.date, date)
      if (gap <= window && gap < bestGap) {
        best = c
        bestGap = gap
      }
    }
    if (best) used.add(best.id)
    return best
  }

  const now = new Date().toISOString()
  const rows: any[] = []
  let expenseHits = 0
  let billHits = 0
  let transferHits = 0

  for (const t of txs) {
    const amount = Number(t.amount)
    // Carried so the upsert can rebuild a valid row; these are not-null columns.
    const base = { id: t.id, account_id: t.account_id, date: t.date, amount: t.amount }

    // Only money out can correspond to a cost. Inflows are customer receipts and
    // belong to the payments ledger, which this does not touch.
    if (amount < 0) {
      const outflow = -amount

      const expense = take(freeExpenses, usedExpense, outflow, t.date, EXPENSE_WINDOW)
      if (expense) {
        expenseHits += 1
        rows.push({
          ...base,
          matched_kind: 'expense',
          matched_id: expense.id,
          matched_at: now,
          matched_note: `Auto: expense dated ${expense.date} for the same amount.`,
        })
        continue
      }

      const bill = take(freeBills, usedBill, outflow, t.date, BILL_WINDOW)
      if (bill) {
        billHits += 1
        rows.push({
          ...base,
          matched_kind: 'bill',
          matched_id: bill.id,
          matched_at: now,
          matched_note: `Auto: vendor bill dated ${bill.date} for the same amount.`,
        })
        continue
      }
    }

    // Only once nothing in the books claims it is the feed's own label trusted.
    if (TRANSFER_CATEGORIES.has(String(t.category || ''))) {
      transferHits += 1
      rows.push({
        ...base,
        matched_kind: 'transfer',
        matched_id: null,
        matched_at: now,
        matched_note: `Auto: feed category ${t.category}. Money moved, not spent.`,
      })
    }
  }

  // Written in chunks rather than one request per row. At a few hundred lines the
  // per-row version took over a minute and would hit a serverless timeout before
  // finishing, leaving the reconciliation half done with no indication of it.
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await admin.from('bank_transactions').upsert(chunk, { onConflict: 'id' })
    if (error) {
      console.error('reconcile/auto-match: write failed:', error.message)
      return NextResponse.json(
        { error: `Saved ${written} of ${rows.length} before failing: ${error.message}` },
        { status: 500 },
      )
    }
    written += chunk.length
  }

  return NextResponse.json({
    written,
    expenses: expenseHits,
    bills: billHits,
    transfers: transferHits,
    remaining: txs.length - rows.length,
  })
}
