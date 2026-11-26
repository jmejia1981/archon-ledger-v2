'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, AlertCircle, ChevronRight, Info } from 'lucide-react'
import {
  buildReceivables,
  buildProjectPnL,
  toCSV,
  downloadCSV,
  type ProjectPnL,
  type ReceivableRow,
} from '@/lib/financials'

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const money2 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)}%`)
const shortDate = (d: string | null) =>
  !d ? '—' : new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const card: React.CSSProperties = { border: '1px solid var(--color-border)' }

function SectionHeader({
  title,
  hint,
  onExport,
  exportLabel,
}: {
  title: string
  hint: string
  onExport?: () => void
  exportLabel?: string
}) {
  return (
    <div className="px-5 sm:px-6 py-4 flex flex-wrap items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>{title}</h2>
        <p className="text-xs mt-0.5 flex items-start gap-1" style={{ color: 'var(--color-muted)' }}>
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{hint}</span>
        </p>
      </div>
      {onExport && (
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
        >
          <Download className="w-3.5 h-3.5" />
          {exportLabel || 'CSV'}
        </button>
      )}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ Receivables */

export function ReceivablesSection({
  invoices,
  clients,
  projects,
  asOf,
}: {
  invoices: any[]
  clients: any[]
  projects: any[]
  asOf: string
}) {
  const router = useRouter()
  const [bucketFilter, setBucketFilter] = useState<string | null>(null)
  const ar = useMemo(() => buildReceivables(invoices, clients, projects, asOf), [invoices, clients, projects, asOf])

  const shown: ReceivableRow[] = bucketFilter ? ar.rows.filter((r) => r.bucket === bucketFilter) : ar.rows

  const byClient = useMemo(() => {
    const m = new Map<string, { name: string; balance: number; count: number; worst: number }>()
    for (const r of ar.rows) {
      const g = m.get(r.clientName) || { name: r.clientName, balance: 0, count: 0, worst: -9999 }
      g.balance += r.balance
      g.count += 1
      g.worst = Math.max(g.worst, r.daysOverdue ?? -9999)
      m.set(r.clientName, g)
    }
    return [...m.values()].sort((a, b) => b.balance - a.balance)
  }, [ar.rows])

  const exportCSV = () => {
    downloadCSV(
      `receivables-${asOf}.csv`,
      toCSV(
        ['Invoice', 'Client', 'Project', 'Invoice date', 'Due date', 'Invoiced', 'Paid', 'Balance', 'Days overdue', 'Bucket', 'Status'],
        shown.map((r) => [
          r.invoiceNumber, r.clientName, r.projectName, r.invoiceDate, r.dueDate,
          r.invoiced.toFixed(2), r.paid.toFixed(2), r.balance.toFixed(2),
          r.daysOverdue === null ? '' : r.daysOverdue, r.bucket, r.status,
        ]),
      ),
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={card}>
      <SectionHeader
        title="Receivables & Ageing"
        hint={`Unpaid invoice balances aged on days past the due date, as at ${shortDate(asOf)}. Balance = invoiced − collected.`}
        onExport={shown.length > 0 ? exportCSV : undefined}
      />

      {ar.rows.length === 0 ? (
        <EmptyState>Nothing outstanding — every invoice raised has been collected in full.</EmptyState>
      ) : (
        <>
          {/* Ageing buckets. Clicking one filters the table below it. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px" style={{ backgroundColor: 'var(--color-border)' }}>
            {ar.buckets.map((b) => {
              const active = bucketFilter === b.key
              const isOverdue = b.key !== 'current' && b.amount > 0
              return (
                <button
                  key={b.key}
                  onClick={() => setBucketFilter(active ? null : b.key)}
                  disabled={b.count === 0}
                  className="px-4 py-3 text-left transition disabled:cursor-default"
                  style={{
                    backgroundColor: active ? 'var(--color-linen)' : 'white',
                    opacity: b.count === 0 ? 0.5 : 1,
                  }}
                >
                  <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--color-muted)' }}>{b.label}</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: isOverdue ? '#b91c1c' : 'var(--color-navy)' }}>
                    {money(b.amount)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {b.count === 0 ? 'none' : `${b.count} invoice${b.count === 1 ? '' : 's'}`}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2" style={{ backgroundColor: 'var(--color-linen)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
              {money2(ar.total)} outstanding
              {ar.overdue > 0 && <span style={{ color: '#b91c1c' }}> · {money2(ar.overdue)} overdue</span>}
            </span>
            {bucketFilter && (
              <button onClick={() => setBucketFilter(null)} className="text-xs font-semibold underline" style={{ color: 'var(--color-navy)' }}>
                Showing {ar.buckets.find((b) => b.key === bucketFilter)?.label} only — show all
              </button>
            )}
          </div>

          {/* Who owes, before the invoice detail. */}
          {byClient.length > 1 && (
            <div className="px-5 sm:px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-muted)' }}>By customer</p>
              <div className="space-y-1.5">
                {byClient.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-3">
                    <span className="text-sm truncate" style={{ color: 'var(--color-navy)' }}>{c.name}</span>
                    <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: c.worst > 0 ? '#b91c1c' : 'var(--color-navy)' }}>
                      {money2(c.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice detail — cards on a phone, table on a desktop. */}
          <div className="sm:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {shown.map((r) => (
              <button key={r.id} onClick={() => router.push(`/dashboard/invoices/${r.id}`)} className="w-full text-left px-5 py-3 active:opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{r.invoiceNumber}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{r.clientName}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{r.projectName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-navy)' }}>{money2(r.balance)}</p>
                    <p className="text-xs" style={{ color: (r.daysOverdue ?? 0) > 0 ? '#b91c1c' : 'var(--color-muted)' }}>
                      {r.daysOverdue === null ? 'no due date' : r.daysOverdue > 0 ? `${r.daysOverdue}d overdue` : `due ${shortDate(r.dueDate)}`}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                <tr>
                  {['Invoice', 'Customer', 'Project', 'Due', 'Invoiced', 'Collected', 'Balance', 'Age'].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${i >= 4 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--color-navy)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/dashboard/invoices/${r.id}`)}
                    className="border-t cursor-pointer hover:bg-gray-50 transition"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{r.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--color-muted)' }}>{r.clientName}</td>
                    <td className="px-4 py-2.5 text-sm max-w-[220px] truncate" style={{ color: 'var(--color-muted)' }} title={r.projectName}>{r.projectName}</td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--color-muted)' }}>{shortDate(r.dueDate)}</td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--color-muted)' }}>{money2(r.invoiced)}</td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--color-muted)' }}>{money2(r.paid)}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-semibold tabular-nums" style={{ color: 'var(--color-navy)' }}>{money2(r.balance)}</td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums" style={{ color: (r.daysOverdue ?? 0) > 0 ? '#b91c1c' : 'var(--color-muted)' }}>
                      {r.daysOverdue === null ? '—' : r.daysOverdue > 0 ? `${r.daysOverdue}d` : 'current'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Collected more than was invoiced. Deliberately not netted off the balances
          above — doing that would hide it behind somebody else's genuine debt. */}
      {ar.overpaid.length > 0 && (
        <div className="px-5 sm:px-6 py-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: '#fef2f2' }}>
          <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#991b1b' }}>
            <AlertCircle className="w-4 h-4" />
            {ar.overpaid.length} invoice{ar.overpaid.length === 1 ? '' : 's'} collected for more than invoiced
          </p>
          <div className="mt-2 space-y-1">
            {ar.overpaid.map((o) => (
              <p key={o.invoiceNumber} className="text-xs" style={{ color: '#991b1b' }}>
                {o.invoiceNumber}: invoiced {money2(o.invoiced)}, collected {money2(o.paid)} — over by <strong>{money2(o.overBy)}</strong>
              </p>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: '#991b1b' }}>
            Total collected is overstated by {money2(ar.overpaid.reduce((s, o) => s + o.overBy, 0))} until these are checked against the bank.
          </p>
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------- Project profitability */

export function ProjectProfitabilitySection({
  projects,
  invoices,
  expenses,
  bills,
  mileage,
  laborByProject,
  mileageCost,
}: {
  projects: any[]
  invoices: any[]
  expenses: any[]
  bills: any[]
  mileage: any[]
  laborByProject: Record<string, number>
  mileageCost: (m: any) => number
}) {
  const router = useRouter()
  const [openOnly, setOpenOnly] = useState(false)

  const all = useMemo(
    () => buildProjectPnL(projects, invoices, expenses, bills, mileage, laborByProject, mileageCost),
    [projects, invoices, expenses, bills, mileage, laborByProject, mileageCost],
  )
  const rows: ProjectPnL[] = openOnly ? all.filter((p) => p.status !== 'completed' && p.status !== 'cancelled') : all
  const shown = rows.filter((p) => p.invoiced > 0 || p.directCost > 0 || p.contract > 0)

  const tot = shown.reduce(
    (a, p) => ({
      contract: a.contract + p.contract,
      invoiced: a.invoiced + p.invoiced,
      collected: a.collected + p.collected,
      cost: a.cost + p.directCost,
      gross: a.gross + p.grossProfit,
    }),
    { contract: 0, invoiced: 0, collected: 0, cost: 0, gross: 0 },
  )
  const totMargin = tot.invoiced > 0 ? (tot.gross / tot.invoiced) * 100 : null

  const exportCSV = () =>
    downloadCSV(
      'project-profitability.csv',
      toCSV(
        ['Project', 'Status', 'Contract', 'Invoiced', 'Collected', 'Outstanding', 'Labour', 'Expenses', 'Bills', 'Mileage', 'Direct cost', 'Gross profit', 'Gross margin %', 'Left to invoice'],
        shown.map((p) => [
          p.name, p.status, p.contract.toFixed(2), p.invoiced.toFixed(2), p.collected.toFixed(2), p.outstanding.toFixed(2),
          p.labor.toFixed(2), p.expenses.toFixed(2), p.bills.toFixed(2), p.mileage.toFixed(2),
          p.directCost.toFixed(2), p.grossProfit.toFixed(2),
          p.grossMargin === null ? '' : p.grossMargin.toFixed(1), p.remainingToInvoice.toFixed(2),
        ]),
      ),
    )

  const marginColor = (m: number | null) =>
    m === null ? 'var(--color-muted)' : m < 0 ? '#b91c1c' : m < 15 ? '#b45309' : '#047857'

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={card}>
      <SectionHeader
        title="Project Profitability"
        hint="Gross profit = invoiced − direct job cost (labour, project expenses, project bills, mileage). Overhead is excluded and deducted after. Revenue is counted when invoiced; cost when paid."
        onExport={shown.length > 0 ? exportCSV : undefined}
      />

      <div className="px-5 sm:px-6 py-2.5 flex items-center gap-3" style={{ backgroundColor: 'var(--color-linen)' }}>
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-navy)' }}>
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="w-3.5 h-3.5" />
          Open jobs only
        </label>
        <span className="text-xs ml-auto" style={{ color: 'var(--color-muted)' }}>
          {shown.length} project{shown.length === 1 ? '' : 's'}
        </span>
      </div>

      {shown.length === 0 ? (
        <EmptyState>No projects with a contract, an invoice or a cost recorded yet.</EmptyState>
      ) : (
        <>
          {/* Phone: one card per job. */}
          <div className="sm:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {shown.map((p) => (
              <button key={p.id} onClick={() => router.push('/dashboard/projects')} className="w-full text-left px-5 py-3 active:opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold min-w-0 flex-1" style={{ color: 'var(--color-navy)' }}>{p.name}</p>
                  <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: marginColor(p.grossMargin) }}>{pct(p.grossMargin)}</span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                  <span>Inv {money(p.invoiced)}</span>
                  <span>Cost {money(p.directCost)}</span>
                  <span>GP {money(p.grossProfit)}</span>
                </div>
                {p.remainingToInvoice > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-navy)' }}>{money(p.remainingToInvoice)} left to invoice</p>
                )}
              </button>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                <tr>
                  {['Project', 'Contract', 'Invoiced', 'Collected', 'Direct cost', 'Gross profit', 'Margin', 'Left to invoice'].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--color-navy)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push('/dashboard/projects')}
                    className="border-t cursor-pointer hover:bg-gray-50 transition"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <td className="px-4 py-2.5 text-sm font-medium max-w-[260px]" style={{ color: 'var(--color-navy)' }}>
                      <span className="block truncate" title={p.name}>{p.name}</span>
                      {p.status !== 'active' && (
                        <span className="text-xs font-normal" style={{ color: 'var(--color-muted)' }}>{p.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--color-muted)' }}>{p.contract > 0 ? money(p.contract) : '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--color-navy)' }}>{money(p.invoiced)}</td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--color-muted)' }}>{money(p.collected)}</td>
                    <td
                      className="px-4 py-2.5 text-sm text-right tabular-nums"
                      style={{ color: 'var(--color-muted)' }}
                      title={`Labour ${money2(p.labor)} · Expenses ${money2(p.expenses)} · Bills ${money2(p.bills)} · Mileage ${money2(p.mileage)}`}
                    >
                      {money(p.directCost)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right font-semibold tabular-nums" style={{ color: marginColor(p.grossMargin) }}>{money(p.grossProfit)}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-semibold tabular-nums" style={{ color: marginColor(p.grossMargin) }}>{pct(p.grossMargin)}</td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums" style={{ color: p.remainingToInvoice < 0 ? '#b45309' : 'var(--color-muted)' }}>
                      {p.contract > 0 ? money(p.remainingToInvoice) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--color-border)' }}>
                <tr style={{ backgroundColor: 'var(--color-linen)' }}>
                  <td className="px-4 py-2.5 text-sm font-bold" style={{ color: 'var(--color-navy)' }}>Total</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: 'var(--color-navy)' }}>{money(tot.contract)}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: 'var(--color-navy)' }}>{money(tot.invoiced)}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: 'var(--color-navy)' }}>{money(tot.collected)}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: 'var(--color-navy)' }}>{money(tot.cost)}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: marginColor(totMargin) }}>{money(tot.gross)}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: marginColor(totMargin) }}>{pct(totMargin)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="px-5 sm:px-6 py-3 text-xs flex items-start gap-1.5" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Direct cost counts only what carries a project. Overhead — bills and expenses with no project on them — is excluded here by
              design and comes off net profit instead. Hover a cost to see its split.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
