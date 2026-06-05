'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, X, Save, AlertCircle, Package } from 'lucide-react'

interface FixedAsset {
  id: string
  name: string
  category: string
  purchase_date: string
  cost: number
  salvage_value: number
  useful_life_years: number
  depreciation_method: 'straight-line' | 'section-179'
  notes?: string
}

const ASSET_CATEGORIES = [
  'Vehicles & Trucks',
  'Heavy Equipment',
  'Tools & Equipment',
  'Office Equipment',
  'Computers & Technology',
  'Furniture & Fixtures',
  'Buildings & Improvements',
  'Other',
]

const emptyForm = {
  name: '',
  category: 'Tools & Equipment',
  purchase_date: new Date().toISOString().split('T')[0],
  cost: '',
  salvage_value: '0',
  useful_life_years: '5',
  depreciation_method: 'straight-line' as 'straight-line' | 'section-179',
  notes: '',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

function calcDepreciation(asset: FixedAsset, asOfYear?: number) {
  const purchaseYear = new Date(asset.purchase_date).getFullYear()
  const currentYear = asOfYear || new Date().getFullYear()
  const yearsOwned = Math.max(0, currentYear - purchaseYear + 1)

  if (asset.depreciation_method === 'section-179') {
    return {
      annualDepreciation: asset.cost,
      accumulatedDepreciation: asset.cost,
      bookValue: asset.salvage_value,
      fullyDepreciated: true,
    }
  }

  const depreciableBase = asset.cost - asset.salvage_value
  const annualDepreciation = asset.useful_life_years > 0 ? depreciableBase / asset.useful_life_years : 0
  const accumulated = Math.min(depreciableBase, annualDepreciation * yearsOwned)
  const bookValue = Math.max(asset.salvage_value, asset.cost - accumulated)
  const fullyDepreciated = accumulated >= depreciableBase

  return { annualDepreciation, accumulatedDepreciation: accumulated, bookValue, fullyDepreciated }
}

const supabase = createClient()

export default function AssetsPage() {
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [tableReady, setTableReady] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [editFormData, setEditFormData] = useState<typeof emptyForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const loadAssets = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('fixed_assets').select('*').order('purchase_date', { ascending: false })
      if (error) { setTableReady(false); setLoading(false); return }
      setAssets(data || [])
    } catch { setTableReady(false) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAssets() }, [loadAssets])

  const totalCost = assets.reduce((s, a) => s + a.cost, 0)
  const totalBookValue = assets.reduce((s, a) => s + calcDepreciation(a, selectedYear).bookValue, 0)
  const currentYearDepr = assets.reduce((s, a) => {
    const { annualDepreciation, fullyDepreciated } = calcDepreciation(a, selectedYear)
    const purchaseYear = new Date(a.purchase_date).getFullYear()
    if (purchaseYear > selectedYear || fullyDepreciated && new Date(a.purchase_date).getFullYear() < selectedYear) return s
    return s + (fullyDepreciated ? 0 : annualDepreciation)
  }, 0)
  const totalAccumulated = assets.reduce((s, a) => s + calcDepreciation(a, selectedYear).accumulatedDepreciation, 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        purchase_date: formData.purchase_date,
        cost: parseFloat(formData.cost) || 0,
        salvage_value: parseFloat(formData.salvage_value) || 0,
        useful_life_years: parseInt(formData.useful_life_years) || 5,
        depreciation_method: formData.depreciation_method,
        notes: formData.notes,
      }
      const { error } = await supabase.from('fixed_assets').insert([payload])
      if (error) throw error
      setFormData(emptyForm)
      setShowForm(false)
      loadAssets()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!selectedAsset || !editFormData) return
    setSaving(true)
    try {
      const payload = {
        name: editFormData.name,
        category: editFormData.category,
        purchase_date: editFormData.purchase_date,
        cost: parseFloat(editFormData.cost) || 0,
        salvage_value: parseFloat(editFormData.salvage_value) || 0,
        useful_life_years: parseInt(editFormData.useful_life_years) || 5,
        depreciation_method: editFormData.depreciation_method,
        notes: editFormData.notes,
      }
      const { error } = await supabase.from('fixed_assets').update(payload).eq('id', selectedAsset.id)
      if (error) throw error
      setSelectedAsset(null)
      setEditFormData(null)
      loadAssets()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this asset?')) return
    await supabase.from('fixed_assets').delete().eq('id', id)
    loadAssets()
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
  const inputStyle = { border: '1px solid var(--color-border)', backgroundColor: 'white' }
  const labelClass = "block text-xs font-medium mb-1"

  const AssetForm = ({ data, onChange, onSave, onCancel, title }: {
    data: typeof emptyForm
    onChange: (d: typeof emptyForm) => void
    onSave: () => void
    onCancel: () => void
    title: string
  }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-navy)' }}>{title}</h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="asset_name">Asset Name *</label>
            <input id="asset_name" name="asset_name" type="text" className={inputClass} style={inputStyle}
              value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="asset_category">Category</label>
            <select id="asset_category" name="asset_category" className={inputClass} style={inputStyle}
              value={data.category} onChange={(e) => onChange({ ...data, category: e.target.value })}>
              {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="purchase_date">Purchase Date</label>
            <input id="purchase_date" name="purchase_date" type="date" className={inputClass} style={inputStyle}
              value={data.purchase_date} onChange={(e) => onChange({ ...data, purchase_date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="asset_cost">Cost *</label>
            <input id="asset_cost" name="asset_cost" type="number" step="0.01" min="0" className={inputClass} style={inputStyle}
              value={data.cost} onChange={(e) => onChange({ ...data, cost: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="salvage_value">Salvage Value</label>
            <input id="salvage_value" name="salvage_value" type="number" step="0.01" min="0" className={inputClass} style={inputStyle}
              value={data.salvage_value} onChange={(e) => onChange({ ...data, salvage_value: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="depreciation_method">Depreciation Method</label>
            <select id="depreciation_method" name="depreciation_method" className={inputClass} style={inputStyle}
              value={data.depreciation_method} onChange={(e) => onChange({ ...data, depreciation_method: e.target.value as 'straight-line' | 'section-179' })}>
              <option value="straight-line">Straight-Line</option>
              <option value="section-179">Section 179 (Full Year 1)</option>
            </select>
          </div>
          {data.depreciation_method === 'straight-line' && (
            <div>
              <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="useful_life_years">Useful Life (years)</label>
              <input id="useful_life_years" name="useful_life_years" type="number" min="1" max="40" className={inputClass} style={inputStyle}
                value={data.useful_life_years} onChange={(e) => onChange({ ...data, useful_life_years: e.target.value })} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="asset_notes">Notes</label>
            <textarea id="asset_notes" name="asset_notes" rows={2} className={inputClass} style={inputStyle}
              value={data.notes} onChange={(e) => onChange({ ...data, notes: e.target.value })} />
          </div>
          {data.cost && data.depreciation_method === 'straight-line' && (
            <div className="sm:col-span-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-navy)' }}>Preview</p>
              <p className="text-xs text-gray-600">
                Annual depreciation: {fmt((parseFloat(data.cost) - parseFloat(data.salvage_value || '0')) / (parseInt(data.useful_life_years) || 5))} / year
                {' '}over {data.useful_life_years} years
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>Cancel</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
            <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>

  if (!tableReady) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-warning)' }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-navy)' }}>Database Setup Required</h2>
        <p className="text-gray-600 mb-6">Run the following SQL in your Supabase SQL Editor:</p>
        <pre className="text-left text-xs p-4 rounded-lg overflow-x-auto" style={{ backgroundColor: '#1e293b', color: '#e2e8f0' }}>{`CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  purchase_date DATE NOT NULL,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  salvage_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  depreciation_method TEXT NOT NULL DEFAULT 'straight-line',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read assets" ON fixed_assets FOR SELECT USING (organization_id = current_org_id());`}</pre>
        <button onClick={() => { setTableReady(true); loadAssets() }} className="mt-6 px-6 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
          I&apos;ve run the SQL — Retry
        </button>
      </div>
    )
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Fixed Assets</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>Equipment, vehicles, and depreciation schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}
          >
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Original Cost', value: fmt(totalCost) },
          { label: `${selectedYear} Depreciation`, value: fmt(currentYearDepr) },
          { label: 'Accumulated Depreciation', value: fmt(totalAccumulated) },
          { label: 'Net Book Value', value: fmt(totalBookValue) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-400">No assets yet. Add equipment, vehicles, or tools.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                <tr>
                  {['Asset', 'Category', 'Purchase Date', 'Cost', 'Method', `${selectedYear} Depr.`, 'Book Value', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const { annualDepreciation, bookValue, fullyDepreciated } = calcDepreciation(asset, selectedYear)
                  const purchaseYear = new Date(asset.purchase_date).getFullYear()
                  const activeThisYear = purchaseYear <= selectedYear
                  const section179 = asset.depreciation_method === 'section-179'
                  const deprThisYear = !activeThisYear ? 0 : section179 ? (purchaseYear === selectedYear ? asset.cost : 0) : (fullyDepreciated ? 0 : annualDepreciation)

                  return (
                    <tr key={asset.id} className="border-t hover:bg-gray-50 cursor-pointer transition-colors" style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => { setSelectedAsset(asset); setEditFormData({ name: asset.name, category: asset.category, purchase_date: asset.purchase_date, cost: asset.cost.toString(), salvage_value: asset.salvage_value.toString(), useful_life_years: asset.useful_life_years.toString(), depreciation_method: asset.depreciation_method, notes: asset.notes || '' }) }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{asset.name}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{asset.category}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                        {new Date(asset.purchase_date + (asset.purchase_date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{fmt(asset.cost)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                        {section179 ? 'Section 179' : `SL / ${asset.useful_life_years}yr`}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: deprThisYear > 0 ? '#dc2626' : 'var(--color-muted)' }}>
                        {deprThisYear > 0 ? `(${fmt(deprThisYear)})` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{fmt(bookValue)}</td>
                      <td className="px-4 py-3">
                        {fullyDepreciated ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>Fully Depreciated</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleDelete(asset.id)} className="p-1 rounded hover:bg-red-50">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <AssetForm data={formData} onChange={setFormData} onSave={handleSave}
          onCancel={() => { setShowForm(false); setFormData(emptyForm) }} title="Add Fixed Asset" />
      )}
      {selectedAsset && editFormData && (
        <AssetForm data={editFormData} onChange={setEditFormData} onSave={handleUpdate}
          onCancel={() => { setSelectedAsset(null); setEditFormData(null) }} title="Edit Fixed Asset" />
      )}
    </div>
  )
}
