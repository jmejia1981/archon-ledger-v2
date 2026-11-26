'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { createClient } from '@/lib/supabase/client'
import { Landmark, Plus, RefreshCw, AlertCircle, Info, Link2 } from 'lucide-react'

const supabase = createClient()

interface BankAccount {
  id: string
  name: string
  institution: string | null
  mask: string | null
  account_type: string
  current_balance: number
  available_balance: number | null
  balance_as_of: string | null
  source: string
  is_active: boolean
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const money2 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)

/**
 * A fed balance is a snapshot, not a live reading. How old it is decides how much
 * weight the figure deserves, so it is stated rather than left to be assumed.
 */
function freshness(asOf: string | null): { days: number | null; label: string; color: string; stale: boolean } {
  if (!asOf) return { days: null, label: 'never updated', color: '#b91c1c', stale: true }
  const then = new Date(asOf).getTime()
  const days = Math.floor((Date.now() - then) / 86400000)
  if (days <= 0) return { days, label: 'updated today', color: '#047857', stale: false }
  if (days === 1) return { days, label: 'updated yesterday', color: '#047857', stale: false }
  if (days <= 7) return { days, label: `${days} days old`, color: '#b45309', stale: false }
  return { days, label: `${days} days old`, color: '#b91c1c', stale: true }
}

const SOURCE_LABEL: Record<string, string> = {
  csv: 'Statement import',
  plaid: 'Plaid',
  manual: 'Entered by hand',
}

export function CashSection() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ balance: '', available: '' })
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newAccount, setNewAccount] = useState({ name: '', institution: '', mask: '', account_type: 'checking', current_balance: '' })

  const load = useCallback(async () => {
    try {
      setError(null)
      const { data, error: err } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name')
      if (err) throw err
      setAccounts((data || []) as BankAccount[])
    } catch (err: any) {
      console.error('Error loading cash accounts:', err)
      setError(err?.message || 'Could not load cash accounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ---- Plaid -------------------------------------------------------------
     The browser never sees PLAID_SECRET or an access token. It asks the server
     for a short-lived link token, Link hands back a one-time public token, and
     the server exchanges that out of sight. */
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState<string | null>(null)

  const startConnect = async () => {
    setError(null)
    setConnecting(true)
    try {
      const res = await fetch('/api/plaid/link-token', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Could not start the bank connection.')
      setLinkToken(body.link_token)
    } catch (err: any) {
      setError(err?.message || 'Could not start the bank connection.')
      setConnecting(false)
    }
  }

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      setConnecting(true)
      try {
        const res = await fetch('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || 'Could not finish linking the bank.')
        // 207: the bank linked but the balances did not store. Say so plainly
        // rather than reporting "Linked 0 accounts", which reads as a success.
        if (body?.warning) {
          setError(body.warning)
        } else {
          setSyncNote(`Linked ${body.linked} account${body.linked === 1 ? '' : 's'}${body.institution ? ` at ${body.institution}` : ''}.`)
        }
        await load()
      } catch (err: any) {
        setError(err?.message || 'Could not finish linking the bank.')
      } finally {
        setConnecting(false)
        setLinkToken(null)
      }
    },
    onExit: () => {
      setConnecting(false)
      setLinkToken(null)
    },
  })

  // Link opens as soon as the token lands, so connecting is one click not two.
  useEffect(() => {
    if (linkToken && plaidReady) openPlaid()
  }, [linkToken, plaidReady, openPlaid])

  const syncNow = async () => {
    setError(null)
    setSyncNote(null)
    setSyncing(true)
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Sync failed.')
      const parts = [
        `${body.accounts} balance${body.accounts === 1 ? '' : 's'} refreshed`,
        body.added ? `${body.added} transaction${body.added === 1 ? '' : 's'} added` : null,
        body.removed ? `${body.removed} removed` : null,
      ].filter(Boolean)
      setSyncNote(body.items === 0 ? 'No bank connected yet.' : parts.join(' · '))
      if (body.errors?.length) setError(body.errors.join(' | '))
      await load()
    } catch (err: any) {
      setError(err?.message || 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  const hasPlaidAccount = accounts.some((a) => a.source === 'plaid')

  const active = accounts.filter((a) => a.is_active)
  // Available where the feed reports it, current otherwise — never zero just
  // because the provider left the field out.
  const spendable = (a: BankAccount) =>
    a.available_balance === null || a.available_balance === undefined
      ? Number(a.current_balance || 0)
      : Number(a.available_balance)

  const cashAccounts = active.filter((a) => a.account_type === 'checking' || a.account_type === 'savings')
  const totalCash = cashAccounts.reduce((s, a) => s + spendable(a), 0)
  const oldest = cashAccounts.reduce<string | null>(
    (acc, a) => (!a.balance_as_of ? acc : !acc || a.balance_as_of < acc ? a.balance_as_of : acc),
    null,
  )
  const overall = freshness(cashAccounts.length === 0 ? null : oldest)

  const startEdit = (a: BankAccount) => {
    setEditing(a.id)
    setDraft({
      balance: String(a.current_balance ?? ''),
      available: a.available_balance === null || a.available_balance === undefined ? '' : String(a.available_balance),
    })
  }

  const saveBalance = async (a: BankAccount) => {
    const bal = parseFloat(draft.balance)
    if (!Number.isFinite(bal)) {
      setError('Enter the balance as a number.')
      return
    }
    const avail = draft.available.trim() === '' ? null : parseFloat(draft.available)
    if (avail !== null && !Number.isFinite(avail)) {
      setError('Available balance must be a number, or left blank.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('bank_accounts')
        .update({
          current_balance: bal,
          available_balance: avail,
          // Typing a figure makes it a hand-entered one, whatever fed it before.
          source: 'manual',
          balance_as_of: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', a.id)
      if (err) throw err
      setEditing(null)
      await load()
    } catch (err: any) {
      console.error('Error saving balance:', err)
      setError(
        /row-level security|42501/i.test(String(err?.message || ''))
          ? 'Could not save — your session may have expired. Sign in again and retry.'
          : err?.message || 'Could not save the balance.',
      )
    } finally {
      setSaving(false)
    }
  }

  const addAccount = async () => {
    if (!newAccount.name.trim()) { setError('Give the account a name.'); return }
    const bal = parseFloat(newAccount.current_balance)
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('bank_accounts').insert([{
        name: newAccount.name.trim(),
        institution: newAccount.institution.trim() || null,
        mask: newAccount.mask.trim() || null,
        account_type: newAccount.account_type,
        current_balance: Number.isFinite(bal) ? bal : 0,
        source: 'manual',
        balance_as_of: Number.isFinite(bal) ? new Date().toISOString() : null,
      }])
      if (err) throw err
      setAdding(false)
      setNewAccount({ name: '', institution: '', mask: '', account_type: 'checking', current_balance: '' })
      await load()
    } catch (err: any) {
      console.error('Error adding account:', err)
      setError(err?.message || 'Could not add the account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
      <div className="px-5 sm:px-6 py-4 flex flex-wrap items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-navy)' }}>
            <Landmark className="w-4 h-4" />
            Cash Position
          </h2>
          <p className="text-xs mt-0.5 flex items-start gap-1" style={{ color: 'var(--color-muted)' }}>
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Available balance where the feed reports one, otherwise the current balance. Checking and savings only —
              credit and loan balances are debts, not cash.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasPlaidAccount && (
            <button
              onClick={syncNow}
              disabled={syncing}
              title="Refresh balances and pull new transactions from the connected bank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          )}
          <button
            onClick={startConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-navy)' }}
          >
            <Link2 className="w-3.5 h-3.5" />
            {connecting ? 'Opening…' : 'Connect bank'}
          </button>
          <button
            onClick={() => setAdding((v) => !v)}
            title="Record an account by hand instead of connecting it"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Manual
          </button>
        </div>
      </div>

      {syncNote && (
        <div className="px-5 sm:px-6 py-2.5 text-sm" style={{ backgroundColor: '#ecfdf5', color: '#065f46' }}>
          {syncNote}
        </div>
      )}

      {error && (
        <div className="px-5 sm:px-6 py-2.5 text-sm flex items-start gap-2" style={{ backgroundColor: '#fef2f2', color: '#991b1b' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {adding && (
        <div className="px-5 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-5 gap-3" style={{ backgroundColor: 'var(--color-linen)', borderBottom: '1px solid var(--color-border)' }}>
          <input value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
            placeholder="Account name *" className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }} />
          <input value={newAccount.institution} onChange={(e) => setNewAccount({ ...newAccount, institution: e.target.value })}
            placeholder="Bank" className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }} />
          <input value={newAccount.mask} onChange={(e) => setNewAccount({ ...newAccount, mask: e.target.value })}
            placeholder="Last 4" maxLength={4} className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)' }} />
          <select value={newAccount.account_type} onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm bg-white" style={{ border: '1px solid var(--color-border)' }}>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit">Credit card</option>
            <option value="loan">Loan</option>
            <option value="other">Other</option>
          </select>
          <div className="flex gap-2">
            <input value={newAccount.current_balance} onChange={(e) => setNewAccount({ ...newAccount, current_balance: e.target.value })}
              placeholder="Balance" type="number" step="0.01" inputMode="decimal"
              className="px-3 py-2 rounded-lg text-sm w-full text-right" style={{ border: '1px solid var(--color-border)' }} />
            <button onClick={addAccount} disabled={saving}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-navy)' }}>Add</button>
          </div>
          <p className="sm:col-span-5 text-xs" style={{ color: 'var(--color-muted)' }}>
            Only the last four digits are stored. This app never holds a full account number or a bank credential.
          </p>
        </div>
      )}

      {loading ? (
        <div className="px-6 py-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Loading cash position…</div>
      ) : accounts.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Landmark className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>No cash accounts yet</p>
          <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--color-muted)' }}>
            Connect a bank through Plaid to pull balances automatically, or type one in by hand —
            nothing is shown as cash until a real balance is recorded.
          </p>
        </div>
      ) : (
        <>
          <div className="px-5 sm:px-6 py-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Available Cash</p>
            <p className="text-3xl font-bold mt-1 tabular-nums" style={{ color: overall.stale ? 'var(--color-muted)' : 'var(--color-navy)' }}>
              {money(totalCash)}
            </p>
            <p className="text-xs mt-1 font-medium" style={{ color: overall.color }}>
              {cashAccounts.length === 0
                ? 'No checking or savings account recorded'
                : `Across ${cashAccounts.length} account${cashAccounts.length === 1 ? '' : 's'} · oldest balance ${overall.label}`}
            </p>
            {overall.stale && cashAccounts.length > 0 && (
              <p className="text-xs mt-1.5 flex items-start gap-1.5" style={{ color: '#b91c1c' }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                This figure is out of date — treat it as a last-known position, not today&apos;s cash.
              </p>
            )}
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {accounts.map((a) => {
              const f = freshness(a.balance_as_of)
              const isCash = a.account_type === 'checking' || a.account_type === 'savings'
              return (
                <div key={a.id} className="px-5 sm:px-6 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                        {a.name}
                        {a.mask && <span className="font-normal" style={{ color: 'var(--color-muted)' }}> ••{a.mask}</span>}
                        {!isCash && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-normal" style={{ backgroundColor: 'var(--color-linen)', color: 'var(--color-muted)' }}>
                            {a.account_type} — not counted as cash
                          </span>
                        )}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        {[a.institution, SOURCE_LABEL[a.source] || a.source].filter(Boolean).join(' · ')}
                        {' · '}
                        <span style={{ color: f.color }}>{f.label}</span>
                      </p>
                    </div>

                    {editing === a.id ? (
                      <div className="flex items-center gap-2">
                        <input value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: e.target.value })}
                          type="number" step="0.01" inputMode="decimal" placeholder="Balance" autoFocus
                          className="w-28 px-2 py-1.5 rounded-lg text-sm text-right" style={{ border: '1px solid var(--color-border)' }} />
                        <input value={draft.available} onChange={(e) => setDraft({ ...draft, available: e.target.value })}
                          type="number" step="0.01" inputMode="decimal" placeholder="Available"
                          title="Leave blank if the bank does not report a separate available balance"
                          className="w-28 px-2 py-1.5 rounded-lg text-sm text-right" style={{ border: '1px solid var(--color-border)' }} />
                        <button onClick={() => saveBalance(a)} disabled={saving}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-navy)' }}>Save</button>
                        <button onClick={() => setEditing(null)} className="text-xs" style={{ color: 'var(--color-muted)' }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-base font-bold tabular-nums" style={{ color: isCash ? 'var(--color-navy)' : 'var(--color-muted)' }}>
                            {money2(spendable(a))}
                          </p>
                          {a.available_balance !== null && a.available_balance !== undefined
                            && Number(a.available_balance) !== Number(a.current_balance) && (
                            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                              {money2(Number(a.current_balance))} current
                            </p>
                          )}
                        </div>
                        <button onClick={() => startEdit(a)} title="Update this balance"
                          className="p-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
