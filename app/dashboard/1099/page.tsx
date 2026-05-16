'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, AlertCircle, CheckCircle, Search } from 'lucide-react'

interface VendorSummary {
  vendor: string
  totalPaid: number
  needs1099: boolean
  taxId: string
  sources: string[]
  billIds: string[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export default function Page1099() {
  const [vendors, setVendors] = useState<VendorSummary[]>([])
  const [filtered, setFiltered] = useState<VendorSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyRequired, setShowOnlyRequired] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [taxIds, setTaxIds] = useState<Record<string, string>>({})
  const [needs1099Flags, setNeeds1099Flags] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const yearStart = `${selectedYear}-01-01`
      const yearEnd = `${selectedYear}-12-31`

      const [billsRes, expensesRes, vendorsRes] = await Promise.all([
        supabase.from('vendor_bills').select('id, vendor, amount_paid, due_date, is_1099_vendor, vendor_tax_id').gte('due_date', yearStart).lte('due_date', yearEnd),
        supabase.from('expenses').select('id, vendor, amount, date, category').gte('date', yearStart).lte('date', yearEnd),
        supabase.from('vendors').select('name, ein, is_1099_required'),
      ])

      const bills = billsRes.data || []
      const expenses = (expensesRes.data || []).filter((e: any) => e.category === 'Subcontractors' && e.vendor)

      // Build vendor records map from vendors table
      const vendorRecords: Record<string, { ein: string; is_1099_required: boolean }> = {}
      ;(vendorsRes.data || []).forEach((v: any) => {
        vendorRecords[v.name.trim()] = { ein: v.ein || '', is_1099_required: v.is_1099_required }
      })

      const map: Record<string, VendorSummary> = {}

      bills.forEach((b: any) => {
        if (!b.vendor || !b.amount_paid) return
        const key = b.vendor.trim()
        if (!map[key]) map[key] = { vendor: key, totalPaid: 0, needs1099: false, taxId: '', sources: [], billIds: [] }
        map[key].totalPaid += b.amount_paid || 0
        map[key].billIds.push(b.id)
        if (!map[key].sources.includes('Vendor Bills')) map[key].sources.push('Vendor Bills')
        if (b.is_1099_vendor) map[key].needs1099 = true
        if (b.vendor_tax_id) map[key].taxId = b.vendor_tax_id
        if (vendorRecords[key]) {
          if (vendorRecords[key].ein && !map[key].taxId) map[key].taxId = vendorRecords[key].ein
          if (vendorRecords[key].is_1099_required) map[key].needs1099 = true
        }
      })

      expenses.forEach((e: any) => {
        if (!e.vendor) return
        const key = e.vendor.trim()
        if (!map[key]) map[key] = { vendor: key, totalPaid: 0, needs1099: false, taxId: '', sources: [], billIds: [] }
        map[key].totalPaid += e.amount || 0
        if (!map[key].sources.includes('Expenses')) map[key].sources.push('Expenses')
        if (vendorRecords[key]) {
          if (vendorRecords[key].ein && !map[key].taxId) map[key].taxId = vendorRecords[key].ein
          if (vendorRecords[key].is_1099_required) map[key].needs1099 = true
        }
      })

      // Include vendors flagged as 1099 even with no transactions yet
      Object.entries(vendorRecords).forEach(([name, rec]) => {
        if (!map[name] && rec.is_1099_required) {
          map[name] = { vendor: name, totalPaid: 0, needs1099: true, taxId: rec.ein, sources: ['Vendors'], billIds: [] }
        }
      })

      const summaries = Object.values(map).sort((a, b) => b.totalPaid - a.totalPaid)
      setVendors(summaries)

      const flags: Record<string, boolean> = {}
      const ids: Record<string, string> = {}
      summaries.forEach((v) => {
        flags[v.vendor] = v.needs1099
        ids[v.vendor] = v.taxId
      })
      setNeeds1099Flags(flags)
      setTaxIds(ids)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedYear, supabase])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    let result = vendors
    if (showOnlyRequired) result = result.filter((v) => v.totalPaid >= 600)
    if (searchTerm) result = result.filter((v) => v.vendor.toLowerCase().includes(searchTerm.toLowerCase()))
    setFiltered(result)
  }, [vendors, showOnlyRequired, searchTerm])

  const saveVendorFlags = async (vendor: string, billIds: string[]) => {
    if (!billIds.length) return
    setSaving(vendor)
    try {
      await supabase.from('vendor_bills').update({
        is_1099_vendor: needs1099Flags[vendor] ?? false,
        vendor_tax_id: taxIds[vendor] || null,
      }).in('id', billIds)
      // Also update vendors table if record exists
      await supabase.from('vendors').update({
        ein: taxIds[vendor] || null,
        is_1099_required: needs1099Flags[vendor] ?? false,
      }).eq('name', vendor)
    } catch (err) { console.error(err) }
    finally { setSaving(null) }
  }

  const exportCSV = () => {
    const rows = [
      ['Vendor', 'EIN / SSN', 'Total Paid', '1099-NEC Required', 'Sources'],
      ...filtered
        .filter((v) => v.totalPaid >= 600)
        .map((v) => [v.vendor, taxIds[v.vendor] || '', fmt(v.totalPaid), v.totalPaid >= 600 ? 'Yes' : 'No', v.sources.join(', ')]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `1099-summary-${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const required = vendors.filter((v) => v.totalPaid >= 600)
  const missing = required.filter((v) => !taxIds[v.vendor])
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>1099-NEC Tracking</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>Vendors & subcontractors paid $600+ (non-employee compensation)</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>1099s Required</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>{required.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>vendors paid $600+</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Missing EIN/SSN</p>
          <p className="text-2xl font-bold" style={{ color: missing.length > 0 ? '#dc2626' : '#10b981' }}>{missing.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>need W-9 on file</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1" style={{ border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Total Non-Employee Comp</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>{fmt(required.reduce((s, v) => s + v.totalPaid, 0))}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>paid to $600+ vendors</p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#991b1b' }}>Action Required: Collect W-9s</p>
            <p className="text-xs mt-1" style={{ color: '#b91c1c' }}>
              {missing.map((v) => v.vendor).join(', ')} — need EIN or SSN before filing 1099-NECs (due Jan 31).
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center" style={{ border: '1px solid var(--color-border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          <input type="text" placeholder="Search vendor..."
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
            style={{ border: '1px solid var(--color-border)' }}
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-navy)' }}>
          <input type="checkbox" checked={showOnlyRequired} onChange={(e) => setShowOnlyRequired(e.target.checked)} className="rounded" />
          Show $600+ only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)' }}>
              <tr>
                {['Vendor', 'Total Paid', 'Sources', 'EIN / SSN', '1099-NEC', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>No vendor payments found for {selectedYear}</td></tr>
              ) : filtered.map((v) => (
                <tr key={v.vendor} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                    <div className="flex items-center gap-2">
                      {v.totalPaid >= 600 && needs1099Flags[v.vendor] && !taxIds[v.vendor] && (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }} />
                      )}
                      {v.totalPaid >= 600 && taxIds[v.vendor] && (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                      )}
                      {v.vendor}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: v.totalPaid >= 600 ? '#dc2626' : 'var(--color-navy)' }}>
                    {fmt(v.totalPaid)}
                    {v.totalPaid >= 600 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>$600+</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>{v.sources.join(', ')}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      placeholder="XX-XXXXXXX"
                      className="w-32 px-2 py-1 rounded text-sm focus:outline-none"
                      style={{ border: '1px solid var(--color-border)' }}
                      value={taxIds[v.vendor] || ''}
                      onChange={(e) => setTaxIds({ ...taxIds, [v.vendor]: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={needs1099Flags[v.vendor] ?? false}
                        onChange={(e) => setNeeds1099Flags({ ...needs1099Flags, [v.vendor]: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-xs" style={{ color: 'var(--color-navy)' }}>Required</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {v.billIds.length > 0 && (
                      <button
                        onClick={() => saveVendorFlags(v.vendor, v.billIds)}
                        disabled={saving === v.vendor}
                        className="px-3 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}
                      >
                        {saving === v.vendor ? 'Saving...' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 rounded-xl text-sm" style={{ backgroundColor: 'var(--color-linen)', border: '1px solid var(--color-border)' }}>
        <p className="font-medium mb-1" style={{ color: 'var(--color-navy)' }}>Filing Notes</p>
        <ul className="space-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          <li>• File 1099-NEC for any non-incorporated vendor/subcontractor paid $600+ during the tax year</li>
          <li>• Corporations (Inc, Corp, LLC taxed as S-Corp) generally do NOT need a 1099</li>
          <li>• Collect W-9 forms to obtain EIN or SSN — keep on file, do not submit to IRS</li>
          <li>• Recipient copies due: January 31 · IRS filing deadline: January 31 (e-file) or February 28 (paper)</li>
        </ul>
      </div>
    </div>
  )
}
