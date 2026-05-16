'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, X, Save, Trash2, AlertCircle, CheckCircle, Building2 } from 'lucide-react'

interface Vendor {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  ein: string | null
  entity_type: string
  is_1099_required: boolean
  w9_on_file: boolean
  w9_date: string | null
  notes: string | null
  created_at: string
}

const ENTITY_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'sole_prop', label: 'Sole Proprietor' },
  { value: 'llc', label: 'LLC' },
  { value: 's_corp', label: 'S-Corp' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'partnership', label: 'Partnership' },
]

const NEEDS_1099 = ['individual', 'sole_prop', 'llc', 'partnership']

const emptyForm = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  ein: '',
  entity_type: 'individual',
  is_1099_required: true,
  w9_on_file: false,
  w9_date: '',
  notes: '',
}

const supabase = createClient()

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [filtered, setFiltered] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'needs_1099' | 'missing_ein' | 'no_w9'>('all')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Vendor | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadVendors = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vendors').select('*').order('name')
    setVendors(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadVendors() }, [loadVendors])

  useEffect(() => {
    let result = vendors
    if (search) result = result.filter(v =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.contact_name || '').toLowerCase().includes(search.toLowerCase())
    )
    if (filter === 'needs_1099') result = result.filter(v => v.is_1099_required)
    if (filter === 'missing_ein') result = result.filter(v => v.is_1099_required && !v.ein)
    if (filter === 'no_w9') result = result.filter(v => v.is_1099_required && !v.w9_on_file)
    setFiltered(result)
  }, [vendors, search, filter])

  const openNew = () => {
    setSelected(null)
    setFormData(emptyForm)
    setShowForm(true)
  }

  const openEdit = (v: Vendor) => {
    setSelected(v)
    setFormData({
      name: v.name,
      contact_name: v.contact_name || '',
      email: v.email || '',
      phone: v.phone || '',
      address: v.address || '',
      city: v.city || '',
      state: v.state || '',
      zip: v.zip || '',
      ein: v.ein || '',
      entity_type: v.entity_type,
      is_1099_required: v.is_1099_required,
      w9_on_file: v.w9_on_file,
      w9_date: v.w9_date || '',
      notes: v.notes || '',
    })
    setShowForm(true)
  }

  const handleEntityTypeChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      entity_type: val,
      is_1099_required: NEEDS_1099.includes(val),
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: formData.name.trim(),
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip: formData.zip || null,
        ein: formData.ein || null,
        entity_type: formData.entity_type,
        is_1099_required: formData.is_1099_required,
        w9_on_file: formData.w9_on_file,
        w9_date: formData.w9_date || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      }
      if (selected) {
        await supabase.from('vendors').update(payload).eq('id', selected.id)
      } else {
        await supabase.from('vendors').insert([payload])
      }
      await loadVendors()
      setShowForm(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor?')) return
    await supabase.from('vendors').delete().eq('id', id)
    setVendors(prev => prev.filter(v => v.id !== id))
  }

  const total1099 = vendors.filter(v => v.is_1099_required).length
  const missingEin = vendors.filter(v => v.is_1099_required && !v.ein).length
  const missingW9 = vendors.filter(v => v.is_1099_required && !v.w9_on_file).length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading vendors...</div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-playfair)' }}>Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>Manage vendor details, W-9s, and 1099 eligibility</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>Total Vendors</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>{vendors.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>1099 Required</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>{total1099}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{missingEin} missing EIN/SSN</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>W-9 on File</p>
          <p className="text-2xl font-bold" style={{ color: missingW9 > 0 ? '#dc2626' : '#059669' }}>
            {total1099 - missingW9}/{total1099}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{missingW9} still needed</p>
        </div>
      </div>

      {/* Alert for missing W-9s */}
      {missingW9 > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>W-9 forms needed</p>
            <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>
              {vendors.filter(v => v.is_1099_required && !v.w9_on_file).map(v => v.name).join(', ')} — collect W-9 before filing 1099-NECs.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 flex flex-col sm:flex-row gap-3" style={{ border: '1px solid var(--color-border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          <input type="text" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
            style={{ border: '1px solid var(--color-border)' }} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'needs_1099', 'missing_ein', 'no_w9'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition"
              style={{
                backgroundColor: filter === f ? 'var(--color-navy)' : 'transparent',
                color: filter === f ? 'white' : 'var(--color-muted)',
                border: `1px solid ${filter === f ? 'var(--color-navy)' : 'var(--color-border)'}`,
              }}>
              {f === 'all' ? 'All' : f === 'needs_1099' ? '1099 Required' : f === 'missing_ein' ? 'Missing EIN' : 'No W-9'}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>No vendors found</div>
        ) : filtered.map(v => (
          <div key={v.id} className="bg-white rounded-xl p-4 active:opacity-75"
            style={{ border: '1px solid var(--color-border)' }}
            onClick={() => openEdit(v)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base truncate" style={{ color: 'var(--color-navy)' }}>{v.name}</p>
                  {v.is_1099_required && v.ein
                    ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                    : v.is_1099_required
                    ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#dc2626' }} />
                    : null}
                </div>
                {v.contact_name && <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>{v.contact_name}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-linen)', color: 'var(--color-navy)' }}>
                    {ENTITY_TYPES.find(t => t.value === v.entity_type)?.label}
                  </span>
                  {v.is_1099_required && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>1099</span>
                  )}
                  {v.w9_on_file && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>W-9 ✓</span>
                  )}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(v.id) }} className="p-1" style={{ color: 'var(--color-destructive)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {v.ein && <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>EIN: {v.ein}</p>}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)' }}>
              <tr>
                {['Vendor', 'Contact', 'Entity Type', 'EIN / SSN', '1099', 'W-9', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>
                  No vendors yet — click &quot;Add Vendor&quot; to get started
                </td></tr>
              ) : filtered.map(v => (
                <tr key={v.id} className="border-t cursor-pointer hover:bg-gray-50 transition"
                  style={{ borderColor: 'var(--color-border)' }}
                  onClick={() => openEdit(v)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {v.is_1099_required && !v.ein
                        ? <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }} />
                        : v.is_1099_required
                        ? <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                        : <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-muted)' }} />}
                      <span className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{v.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                    <div>{v.contact_name || '—'}</div>
                    {v.email && <div className="text-xs">{v.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                    {ENTITY_TYPES.find(t => t.value === v.entity_type)?.label}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono" style={{ color: v.ein ? 'var(--color-navy)' : '#dc2626' }}>
                    {v.ein || (v.is_1099_required ? 'MISSING' : '—')}
                  </td>
                  <td className="px-4 py-3">
                    {v.is_1099_required
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Required</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--color-linen)', color: 'var(--color-muted)' }}>No</span>}
                  </td>
                  <td className="px-4 py-3">
                    {v.w9_on_file
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>On File</span>
                      : v.is_1099_required
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Needed</span>
                      : <span className="text-xs" style={{ color: 'var(--color-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDelete(v.id)} className="p-1 hover:opacity-70 transition" style={{ color: 'var(--color-destructive)' }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>
                {selected ? 'Edit Vendor' : 'Add Vendor'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100 transition">
                <X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Vendor / Business Name *</label>
                <input required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)' }} placeholder="Acme Plumbing LLC" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Contact Name</label>
                  <input value={formData.contact_name} onChange={e => setFormData(p => ({ ...p, contact_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ borderColor: 'var(--color-border)' }} placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ borderColor: 'var(--color-border)' }} placeholder="john@acme.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Phone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)' }} placeholder="(555) 000-0000" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Street Address</label>
                <input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)' }} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>City</label>
                  <input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>State</label>
                  <input value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ borderColor: 'var(--color-border)' }} placeholder="TX" maxLength={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>ZIP</label>
                  <input value={formData.zip} onChange={e => setFormData(p => ({ ...p, zip: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ borderColor: 'var(--color-border)' }} placeholder="78701" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Entity Type</label>
                  <select value={formData.entity_type} onChange={e => handleEntityTypeChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>
                    {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>EIN / SSN</label>
                  <input value={formData.ein} onChange={e => setFormData(p => ({ ...p, ein: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none"
                    style={{ borderColor: 'var(--color-border)' }} placeholder="XX-XXXXXXX" />
                </div>
              </div>

              <div className="p-3 rounded-xl space-y-3" style={{ backgroundColor: 'var(--color-linen)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>1099-NEC Required</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>Auto-set based on entity type</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.is_1099_required}
                      onChange={e => setFormData(p => ({ ...p, is_1099_required: e.target.checked }))}
                      className="sr-only peer" />
                    <div className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                      style={{ backgroundColor: formData.is_1099_required ? 'var(--color-navy)' : '#d1d5db' }} />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>W-9 on File</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.w9_on_file}
                      onChange={e => setFormData(p => ({ ...p, w9_on_file: e.target.checked }))}
                      className="sr-only peer" />
                    <div className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                      style={{ backgroundColor: formData.w9_on_file ? '#059669' : '#d1d5db' }} />
                  </label>
                </div>
                {formData.w9_on_file && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>W-9 Date Received</label>
                    <input type="date" value={formData.w9_date} onChange={e => setFormData(p => ({ ...p, w9_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none"
                  style={{ borderColor: 'var(--color-border)' }} placeholder="Optional notes..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border font-medium text-sm hover:bg-gray-50 transition"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--color-navy)' }}>
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
