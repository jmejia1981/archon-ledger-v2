/**
 * Receivables ageing, per-project profitability and backlog.
 *
 * Pure functions over rows already loaded by the dashboard, so they can be checked
 * against SQL without a browser.
 *
 * ACCOUNTING BASIS — stated once here and applied the same way throughout:
 *
 *   Revenue is recognised when invoiced (invoice_date), not when collected. Cash
 *   collected is reported separately and never called revenue.
 *
 *   Direct job cost is what can be tied to a project: labour from payroll allocated
 *   over that week's labour entries, expenses and vendor bills carrying a
 *   project_id, and mileage at the IRS rate. Cost is counted when paid.
 *
 *   Gross profit = revenue − direct job cost. Overhead — anything not tied to a
 *   project — is excluded from gross profit and deducted after it.
 *
 * Revenue is therefore accrual and cost is cash, which is a hybrid. It is the basis
 * the existing dashboard already used; it is named rather than silently changed,
 * because changing it would restate every figure on the page.
 *
 * Nothing here invents a number. Where an input is missing the result is null and
 * the caller shows an empty state rather than a zero that reads like a fact.
 */

export interface AgingBucket {
  key: string
  label: string
  /** Lower bound of days overdue, inclusive. */
  from: number
  count: number
  amount: number
}

export interface ReceivableRow {
  id: string
  invoiceNumber: string
  clientId: string | null
  clientName: string
  projectId: string | null
  projectName: string
  invoiceDate: string | null
  dueDate: string | null
  invoiced: number
  paid: number
  balance: number
  /** Positive once past due; negative while still within terms. */
  daysOverdue: number | null
  bucket: string
  status: string
}

const num = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Local calendar date, never toISOString — that shifts west of UTC in the evening. */
export function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T00:00:00`)
  const b = new Date(`${toISO}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export const AGING_BUCKETS: { key: string; label: string; from: number }[] = [
  { key: 'current', label: 'Current', from: -Infinity },
  { key: '1-30', label: '1–30 days', from: 1 },
  { key: '31-60', label: '31–60 days', from: 31 },
  { key: '61-90', label: '61–90 days', from: 61 },
  { key: '90+', label: 'Over 90 days', from: 91 },
]

function bucketFor(daysOverdue: number | null): string {
  if (daysOverdue === null || daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

/**
 * Open receivables, aged against `asOf`.
 *
 * Only balances actually owed are included. An invoice collected for more than it
 * was raised is NOT netted against the others: that would quietly hide an
 * overpayment behind somebody else's genuine debt. Those are returned separately in
 * `overpaid` so they can be shown as the exception they are.
 */
export function buildReceivables(
  invoices: any[],
  clients: any[],
  projects: any[],
  asOf: string = toLocalISODate(new Date()),
): {
  rows: ReceivableRow[]
  buckets: AgingBucket[]
  total: number
  overdue: number
  overpaid: { invoiceNumber: string; invoiced: number; paid: number; overBy: number }[]
} {
  const clientName = (id: string | null) =>
    (id && clients.find((c: any) => c.id === id)?.name) || 'Unknown client'
  const projectName = (id: string | null) =>
    (id && projects.find((p: any) => p.id === id)?.project_name?.trim()) || 'No project'

  const rows: ReceivableRow[] = []
  const overpaid: { invoiceNumber: string; invoiced: number; paid: number; overBy: number }[] = []

  for (const inv of invoices || []) {
    const invoiced = num(inv.invoice_amount)
    const paid = num(inv.amount_paid)
    const balance = invoiced - paid

    if (balance < -0.005) {
      overpaid.push({
        invoiceNumber: inv.invoice_number || '—',
        invoiced,
        paid,
        overBy: paid - invoiced,
      })
      continue
    }
    if (balance <= 0.005) continue

    const dueDate = inv.due_date || null
    const daysOverdue = dueDate ? daysBetween(dueDate, asOf) : null

    rows.push({
      id: inv.id,
      invoiceNumber: inv.invoice_number || '—',
      clientId: inv.client_id || null,
      clientName: clientName(inv.client_id),
      projectId: inv.project_id || null,
      projectName: projectName(inv.project_id),
      invoiceDate: inv.invoice_date || null,
      dueDate,
      invoiced,
      paid,
      balance,
      daysOverdue,
      bucket: bucketFor(daysOverdue),
      status: inv.status || 'unknown',
    })
  }

  const buckets: AgingBucket[] = AGING_BUCKETS.map((b) => {
    const mine = rows.filter((r) => r.bucket === b.key)
    return {
      ...b,
      count: mine.length,
      amount: mine.reduce((s, r) => s + r.balance, 0),
    }
  })

  return {
    rows: rows.sort((a, b) => (b.daysOverdue ?? -9999) - (a.daysOverdue ?? -9999)),
    buckets,
    total: rows.reduce((s, r) => s + r.balance, 0),
    overdue: rows.filter((r) => r.bucket !== 'current').reduce((s, r) => s + r.balance, 0),
    overpaid: overpaid.sort((a, b) => b.overBy - a.overBy),
  }
}

export interface ProjectPnL {
  id: string
  name: string
  status: string
  contract: number
  invoiced: number
  collected: number
  outstanding: number
  /** Costs that carry this project's id, plus labour allocated to it. */
  directCost: number
  labor: number
  expenses: number
  bills: number
  mileage: number
  grossProfit: number
  /** null when there is no revenue to divide by, never 0. */
  grossMargin: number | null
  /** Contract still to invoice. Negative means billed past the contract. */
  remainingToInvoice: number
  /** Share of the contract already invoiced, null when there is no contract on file. */
  percentInvoiced: number | null
}

/**
 * Per-project profit on the basis described at the top of this file.
 *
 * `laborByProject` is passed in rather than derived here: payroll carries no
 * project, so the split comes from the dashboard's existing payroll allocation over
 * labour entries, and duplicating that logic would let the two drift apart.
 */
export function buildProjectPnL(
  projects: any[],
  invoices: any[],
  expenses: any[],
  bills: any[],
  mileage: any[],
  laborByProject: Record<string, number>,
  mileageCost: (m: any) => number,
): ProjectPnL[] {
  const sumBy = (rows: any[], projectId: string, field: string) =>
    (rows || [])
      .filter((r: any) => r.project_id === projectId)
      .reduce((s: number, r: any) => s + num(r[field]), 0)

  return (projects || [])
    .map((p: any) => {
      const contract = num(p.contract_budget)
      const mine = (invoices || []).filter((i: any) => i.project_id === p.id)
      const invoiced = mine.reduce((s: number, i: any) => s + num(i.invoice_amount), 0)
      const collected = mine.reduce((s: number, i: any) => s + num(i.amount_paid), 0)

      const labor = num(laborByProject[p.id])
      const exp = sumBy(expenses, p.id, 'amount')
      const bil = sumBy(bills, p.id, 'amount_paid')
      const mil = (mileage || [])
        .filter((m: any) => m.project_id === p.id)
        .reduce((s: number, m: any) => s + mileageCost(m), 0)

      const directCost = labor + exp + bil + mil
      const grossProfit = invoiced - directCost

      return {
        id: p.id,
        name: String(p.project_name || 'Unnamed').trim(),
        status: p.status || 'unknown',
        contract,
        invoiced,
        collected,
        outstanding: invoiced - collected,
        directCost,
        labor,
        expenses: exp,
        bills: bil,
        mileage: mil,
        grossProfit,
        grossMargin: invoiced > 0 ? (grossProfit / invoiced) * 100 : null,
        remainingToInvoice: contract - invoiced,
        percentInvoiced: contract > 0 ? (invoiced / contract) * 100 : null,
      }
    })
    .sort((a, b) => b.invoiced - a.invoiced)
}

/**
 * Contracted work not yet invoiced, on signed projects only.
 *
 * Proposals are deliberately excluded: an unsigned proposal is not contracted work,
 * and folding the two together would overstate what the business is owed. A project
 * billed past its contract contributes zero rather than a negative, so one job
 * running over cannot mask another's remaining work.
 */
export function buildBacklog(projects: any[], invoices: any[]) {
  const active = (projects || []).filter((p: any) => p.status !== 'completed' && p.status !== 'cancelled')
  let contract = 0
  let invoiced = 0
  let backlog = 0
  let overbilled = 0

  for (const p of active) {
    const c = num(p.contract_budget)
    const b = (invoices || [])
      .filter((i: any) => i.project_id === p.id)
      .reduce((s: number, i: any) => s + num(i.invoice_amount), 0)
    contract += c
    invoiced += b
    if (c - b > 0) backlog += c - b
    else overbilled += b - c
  }

  return { projectCount: active.length, contract, invoiced, backlog, overbilled }
}

/** RFC 4180 enough for Excel: quote every field, double embedded quotes. */
export function toCSV(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n')
}

export function downloadCSV(filename: string, csv: string) {
  // BOM so Excel reads it as UTF-8 rather than the system codepage.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
