'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, AlertTriangle, ArrowLeftRight, Check, Info, Loader2, RefreshCw, Wallet, X,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { TAX_CATEGORY_OPTIONS, suggestFromFeedCategory } from '@/lib/tax-categories'

interface Txn {
  id: string
  date: string
  amount: number
  description: string | null
  category: string | null
  pending: boolean
  matched_kind: string | null
  matched_note: string | null
}

interface Project {
  id: string
  name: string
  status: string | null
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)

type Tab = 'review' | 'expense' | 'transfer' | 'owner_draw' | 'ignored' | 'pending'

const TABS: { key: Tab; label: string }[] = [
  { key: 'review', label: 'To review' },
  { key: 'pending', label: 'Pending' },
  { key: 'expense', label: 'Already booked' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'owner_draw', label: 'Owner draws' },
  { key: 'ignored', label: 'Ignored' },
]

export default function ReconcilePage() {
  const supabase = createClient()

  const [txns, setTxns] = useState<Txn[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('review')
  const [open, setOpen] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [feedFilter, setFeedFilter] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkGroup, setBulkGroup] = useState('company-overhead')

  // A draft per row, so editing one never disturbs another.
  const [draft, setDraft] = useState<Record<string, { vendor: string; taxCategory: string; group: string; projectId: string }>>({})

  const load = useCallback(async () => {
    try {
      setError(null)
      const [{ data: t, error: tErr }, { data: p }] = await Promise.all([
        supabase.from('bank_transactions')
          .select('id, date, amount, description, category, pending, matched_kind, matched_note')
          .order('date', { ascending: false }),
        supabase.from('projects').select('id, name, status').order('name'),
      ])
      if (tErr) throw tErr
      setTxns((t || []) as Txn[])
      setProjects((p || []) as Project[])
    } catch (err: any) {
      setError(err?.message || 'Could not load bank transactions.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const outflows = useMemo(() => txns.filter((t) => Number(t.amount) < 0), [txns])

  const buckets = useMemo(() => ({
    // Pending is its own bucket. An unsettled amount is not reviewable, and it
    // must not sit in the queue looking like a decision waiting to be made.
    pending: outflows.filter((t) => t.pending),
    review: outflows.filter((t) => !t.pending && !t.matched_kind),
    expense: outflows.filter((t) => t.matched_kind === 'expense' || t.matched_kind === 'bill'),
    transfer: outflows.filter((t) => t.matched_kind === 'transfer'),
    owner_draw: outflows.filter((t) => t.matched_kind === 'owner_draw'),
    ignored: outflows.filter((t) => t.matched_kind === 'ignored'),
  }), [outflows])

  const sum = (rows: Txn[]) => rows.reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const runAutoMatch = async () => {
    setMatching(true); setError(null); setNote(null)
    try {
      const res = await fetch('/api/reconcile/auto-match', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Auto-match failed.')
      setNote(
        `Matched ${body.expenses} to expenses already recorded, ${body.bills} to vendor bills, ` +
        `and marked ${body.transfers} as transfers. ${body.remaining} left to review.`,
      )
      await load()
    } catch (err: any) {
      setError(err?.message || 'Auto-match failed.')
    } finally {
      setMatching(false)
    }
  }

  const decide = async (t: Txn, kind: 'owner_draw' | 'transfer' | 'ignored' | null, why: string) => {
    setBusy(t.id); setError(null)
    try {
      const { error: err } = await supabase.from('bank_transactions').update({
        matched_kind: kind,
        matched_at: kind ? new Date().toISOString() : null,
        matched_note: kind ? why : null,
        ...(kind ? {} : { matched_id: null }),
      }).eq('id', t.id)
      if (err) throw err
      setTxns((prev) => prev.map((r) => (r.id === t.id ? { ...r, matched_kind: kind, matched_note: kind ? why : null } : r)))
    } catch (err: any) {
      setError(err?.message || 'Could not save that.')
    } finally {
      setBusy(null)
    }
  }

  const createExpense = async (t: Txn) => {
    const d = draft[t.id]
    if (!d?.taxCategory) { setError('Pick a Schedule C category before booking this.'); return }
    setBusy(t.id); setError(null)
    try {
      const amount = Math.abs(Number(t.amount))
      const { data: created, error: insErr } = await supabase.from('expenses').insert({
        date: t.date,
        vendor: d.vendor || t.description || 'Unknown',
        amount,
        category_group: d.group,
        category: 'General',
        tax_category: d.taxCategory,
        project_id: d.projectId || null,
        payment_status: 'paid',
        description: t.description,
        notes: `Reconciled from bank feed on ${new Date().toISOString().slice(0, 10)}.`,
      }).select('id').single()
      if (insErr) throw insErr

      // Link the bank line to the row it produced, so a re-run cannot book it twice.
      const { error: linkErr } = await supabase.from('bank_transactions').update({
        matched_kind: 'expense',
        matched_id: created.id,
        matched_at: new Date().toISOString(),
        matched_note: 'Expense created from this line during reconciliation.',
      }).eq('id', t.id)
      if (linkErr) throw linkErr

      setTxns((prev) => prev.map((r) => (r.id === t.id ? { ...r, matched_kind: 'expense' } : r)))
      setOpen(null)
      setNote(`Booked ${money(amount)} to ${d.taxCategory}.`)
    } catch (err: any) {
      setError(err?.message || 'Could not create the expense.')
    } finally {
      setBusy(null)
    }
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkDecide = async (kind: 'owner_draw' | 'transfer' | 'ignored') => {
    const ids = [...selected]
    if (ids.length === 0) return
    setBusy('bulk'); setError(null); setNote(null)
    try {
      const { error: err } = await supabase.from('bank_transactions').update({
        matched_kind: kind,
        matched_at: new Date().toISOString(),
        matched_note: `Marked as ${kind.replace('_', ' ')} during reconciliation.`,
      }).in('id', ids)
      if (err) throw err
      setTxns((prev) => prev.map((r) => (selected.has(r.id) ? { ...r, matched_kind: kind } : r)))
      setSelected(new Set())
      setNote(`${ids.length} marked as ${kind.replace('_', ' ')}.`)
    } catch (err: any) {
      setError(err?.message || 'Could not update those.')
    } finally {
      setBusy(null)
    }
  }

  const bulkBook = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!bulkCategory) { setError('Pick a Schedule C category for the selected lines.'); return }
    setBusy('bulk'); setError(null); setNote(null)
    try {
      const res = await fetch('/api/reconcile/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: ids.map((id) => ({ id, taxCategory: bulkCategory, group: bulkGroup })),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Could not book those.')
      setSelected(new Set())
      setNote(
        `Booked ${body.booked} to ${bulkCategory}` +
        (body.skipped ? `. ${body.skipped} skipped — already decided elsewhere.` : '.'),
      )
      await load()
    } catch (err: any) {
      setError(err?.message || 'Could not book those.')
    } finally {
      setBusy(null)
    }
  }

  const openRow = (t: Txn) => {
    if (open === t.id) { setOpen(null); return }
    const s = suggestFromFeedCategory(t.category)
    setDraft((prev) => ({
      ...prev,
      [t.id]: prev[t.id] || {
        vendor: t.description || '',
        taxCategory: s.taxCategory || '',
        group: s.categoryGroup,
        projectId: '',
      },
    }))
    setOpen(t.id)
  }

  const openProjects = projects.filter((p) => p.status !== 'completed' && p.status !== 'cancelled')
  const rows = buckets[tab].filter((t) => !feedFilter || (t.category || '') === feedFilter)

  // The categories actually present in this tab, so the filter never offers an
  // option that selects nothing.
  const feedCategories = [...new Set(buckets[tab].map((t) => t.category || '').filter(Boolean))].sort()
  const allShownSelected = rows.length > 0 && rows.every((t) => selected.has(t.id))

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm py-16 justify-center" style={{ color: 'var(--color-muted)' }}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading bank activity…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Reconcile</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            Every payment that left the bank, and whether it is already in your books.
          </p>
        </div>
        <button
          onClick={runAutoMatch}
          disabled={matching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <RefreshCw className={`w-4 h-4 ${matching ? 'animate-spin' : ''}`} />
          {matching ? 'Matching…' : 'Auto-match'}
        </button>
      </div>

      <div className="rounded-lg px-4 py-3 text-xs flex items-start gap-2" style={{ backgroundColor: 'var(--color-linen)', color: 'var(--color-muted)' }}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Auto-match writes no expenses. It only records what each bank line already corresponds to, so this
          queue shows what is genuinely unaccounted for. Nothing reaches your books until you book it here.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['To review', buckets.review, '#b45309'],
          ['Already booked', buckets.expense, '#065f46'],
          ['Transfers — not costs', buckets.transfer, '#1f2937'],
          ['Owner draws', buckets.owner_draw, '#991b1b'],
        ] as const).map(([label, rowsFor, color]) => (
          <div key={label} className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{label}</p>
            <p className="text-xl font-bold mt-1" style={{ color }}>{money(sum(rowsFor as Txn[]))}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{(rowsFor as Txn[]).length} transactions</p>
          </div>
        ))}
      </div>

      {note && (
        <div className="rounded-lg px-4 py-2.5 text-sm" style={{ backgroundColor: '#ecfdf5', color: '#065f46' }}>{note}</div>
      )}
      {error && (
        <div className="rounded-lg px-4 py-2.5 text-sm flex items-start gap-2" style={{ backgroundColor: '#fef2f2', color: '#991b1b' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={tab === t.key
              ? { backgroundColor: 'var(--color-navy)', color: 'white' }
              : { border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
          >
            {t.label} ({buckets[t.key].length})
          </button>
        ))}
      </div>

      {tab === 'pending' && rows.length > 0 && (
        <div className="rounded-lg px-4 py-2.5 text-sm flex items-start gap-2" style={{ backgroundColor: '#fffbeb', color: '#92400e' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Still pending at the bank. The amount can change or the charge can disappear, so these are not
            bookable yet. They move into &ldquo;To review&rdquo; once they settle.</span>
        </div>
      )}

      {tab === 'review' && buckets.review.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={feedFilter}
              onChange={(e) => { setFeedFilter(e.target.value); setSelected(new Set()) }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
            >
              <option value="">All categories</option>
              {feedCategories.map((c) => (
                <option key={c} value={c}>{c.toLowerCase().replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={() => setSelected(allShownSelected ? new Set() : new Set(rows.map((t) => t.id)))}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
            >
              {allShownSelected ? 'Clear selection' : `Select all ${rows.length} shown`}
            </button>
            {selected.size > 0 && (
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {selected.size} selected ·{' '}
                {money(rows.filter((t) => selected.has(t.id)).reduce((a, t) => a + Math.abs(Number(t.amount)), 0))}
              </span>
            )}
          </div>

          {selected.size > 0 && (
            <div className="rounded-lg p-3 flex flex-wrap items-end gap-2" style={{ backgroundColor: 'var(--color-linen)', border: '1px solid var(--color-border)' }}>
              <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Schedule C category
                <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}
                  className="mt-1 block px-2 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)', minWidth: '15rem' }}>
                  <option value="">Choose…</option>
                  {TAX_CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Cost type
                <select value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)}
                  className="mt-1 block px-2 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }}>
                  <option value="company-overhead">Company overhead</option>
                  <option value="direct-project-costs">Direct project cost</option>
                </select>
              </label>
              <button onClick={bulkBook} disabled={busy === 'bulk'}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#065f46' }}>
                {busy === 'bulk' ? 'Working…' : `Book ${selected.size} as expenses`}
              </button>
              <button onClick={() => bulkDecide('owner_draw')} disabled={busy === 'bulk'}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}>
                Owner draw
              </button>
              <button onClick={() => bulkDecide('transfer')} disabled={busy === 'bulk'}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}>
                Transfer
              </button>
              <button onClick={() => bulkDecide('ignored')} disabled={busy === 'bulk'}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}>
                Ignore
              </button>
              <p className="text-xs w-full" style={{ color: 'var(--color-muted)' }}>
                Bulk booking applies one category to every selected line and leaves the project unset. Use a
                single row when the project matters.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
            {tab === 'review' ? 'Nothing left to review — every settled payment is accounted for.' : 'Nothing here.'}
          </div>
        ) : rows.map((t) => {
          const s = suggestFromFeedCategory(t.category)
          const d = draft[t.id]
          const isOpen = open === t.id
          return (
            <div key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3">
                {tab === 'review' && (
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    aria-label={`Select ${t.description || 'payment'}`}
                    className="w-4 h-4 flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-navy)' }}>
                    {t.description || 'Unlabelled payment'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {t.date}{t.category ? ` · ${t.category.toLowerCase().replace(/_/g, ' ')}` : ''}
                    {t.matched_note ? ` · ${t.matched_note}` : ''}
                  </p>
                  {s.warning && tab === 'review' && (
                    <p className="text-xs mt-0.5 flex items-start gap-1" style={{ color: '#92400e' }}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{s.warning}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-navy)' }}>
                  {money(Math.abs(Number(t.amount)))}
                </p>
                {tab === 'review' && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => openRow(t)} disabled={busy === t.id}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-navy)' }}>
                      {isOpen ? 'Close' : 'Book as expense'}
                    </button>
                    <button onClick={() => decide(t, 'owner_draw', 'Marked as an owner draw during reconciliation.')}
                      disabled={busy === t.id} title="Not a business cost — an owner distribution"
                      className="p-1.5 rounded-lg disabled:opacity-50" style={{ border: '1px solid var(--color-border)' }}>
                      <Wallet className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => decide(t, 'transfer', 'Marked as a transfer during reconciliation.')}
                      disabled={busy === t.id} title="Moving your own money, not a cost"
                      className="p-1.5 rounded-lg disabled:opacity-50" style={{ border: '1px solid var(--color-border)' }}>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => decide(t, 'ignored', 'Ignored during reconciliation.')}
                      disabled={busy === t.id} title="Ignore this line"
                      className="p-1.5 rounded-lg disabled:opacity-50" style={{ border: '1px solid var(--color-border)' }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {tab !== 'review' && tab !== 'pending' && (
                  <button onClick={() => decide(t, null, '')} disabled={busy === t.id}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                    Undo
                  </button>
                )}
              </div>

              {isOpen && d && (
                <div className="px-4 sm:px-5 pb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ backgroundColor: 'var(--color-linen)' }}>
                  <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    Vendor
                    <input value={d.vendor} onChange={(e) => setDraft((p) => ({ ...p, [t.id]: { ...d, vendor: e.target.value } }))}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }} />
                  </label>
                  <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    Schedule C category
                    <select value={d.taxCategory} onChange={(e) => setDraft((p) => ({ ...p, [t.id]: { ...d, taxCategory: e.target.value } }))}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }}>
                      <option value="">Choose…</option>
                      {TAX_CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    Cost type
                    <select value={d.group} onChange={(e) => setDraft((p) => ({ ...p, [t.id]: { ...d, group: e.target.value } }))}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }}>
                      <option value="direct-project-costs">Direct project cost</option>
                      <option value="company-overhead">Company overhead</option>
                    </select>
                  </label>
                  <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    Project (optional)
                    <select value={d.projectId} onChange={(e) => setDraft((p) => ({ ...p, [t.id]: { ...d, projectId: e.target.value } }))}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }}>
                      <option value="">No project</option>
                      {openProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <button onClick={() => createExpense(t)} disabled={busy === t.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: '#065f46' }}>
                      <Check className="w-3.5 h-3.5" />
                      {busy === t.id ? 'Saving…' : `Book ${money(Math.abs(Number(t.amount)))} as an expense`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
