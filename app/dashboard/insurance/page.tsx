'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, X, Save, AlertCircle, Shield, Upload, Eye, Download, FileText } from 'lucide-react'

interface InsurancePolicy {
  id: string
  policy_type: string
  carrier: string
  policy_number?: string
  effective_date?: string
  expiration_date?: string
  coverage_limit: number
  premium: number
  notes?: string
  file_path?: string
  file_name?: string
  file_size?: number
  file_type?: string
}

const POLICY_TYPES = [
  'General Liability',
  'Workers Compensation',
  'Commercial Auto',
  'Umbrella / Excess',
  'Builders Risk',
  'Professional Liability',
  'Inland Marine',
  'Property',
  'Other',
]

const BUCKET = 'insurance-policies'
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'
const MAX_BYTES = 20 * 1024 * 1024

const emptyForm = {
  policy_type: 'General Liability',
  carrier: '',
  policy_number: '',
  effective_date: '',
  expiration_date: '',
  coverage_limit: '',
  premium: '',
  notes: '',
}

const supabase = createClient()

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

function fmtDate(d?: string) {
  return d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Days until expiration drives the status badge — the reason to keep policies here at all.
function policyStatus(expiration?: string) {
  if (!expiration) return { label: 'No expiration', tone: 'bg-gray-100 text-gray-700', days: null as number | null }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiration + 'T00:00:00')
  const days = Math.round((exp.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { label: 'Expired', tone: 'bg-red-100 text-red-800', days }
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'bg-yellow-100 text-yellow-800', days }
  return { label: 'Active', tone: 'bg-green-100 text-green-800', days }
}

export default function InsurancePage() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [tableReady, setTableReady] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null)
  const [editFormData, setEditFormData] = useState<typeof emptyForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busyFileId, setBusyFileId] = useState<string | null>(null)
  // Holds the uploaded object until the row is saved, so the form can show the
  // attachment before the policy exists.
  const [pendingFile, setPendingFile] = useState<{ path: string; name: string; size: number; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPolicies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('insurance_policies')
        .select('*')
        .order('expiration_date', { ascending: true, nullsFirst: false })
      if (error) { setTableReady(false); setLoading(false); return }
      setPolicies(data || [])
    } catch { setTableReady(false) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadPolicies() }, [loadPolicies])

  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_BYTES) {
      alert(`"${file.name}" is ${fmtSize(file.size)}. The limit is 20 MB.`)
      return
    }
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be signed in to upload a policy document.')
      // Flat `insurance/` prefix: this schema has no tenancy column to scope by, and
      // the bucket's policies grant the authenticated role access to the whole bucket.
      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'pdf'
      const path = `insurance/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/pdf',
      })
      if (error) throw error
      setPendingFile({ path, name: file.name, size: file.size, type: file.type || 'application/pdf' })
    } catch (err: any) {
      console.error('Error uploading policy document:', err)
      alert('Failed to upload document: ' + (err?.message || 'unknown error'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // The bucket is private, so every view/download mints a short-lived signed URL.
  const openFile = async (policy: InsurancePolicy, download: boolean) => {
    if (!policy.file_path) return
    setBusyFileId(policy.id)
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(policy.file_path, 60 * 60, download ? { download: policy.file_name || true } : undefined)
      if (error) throw error
      if (!data?.signedUrl) throw new Error('Could not generate a link for this document.')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
      console.error('Error opening policy document:', err)
      alert('Failed to open document: ' + (err?.message || 'unknown error'))
    } finally {
      setBusyFileId(null)
    }
  }

  const buildPayload = (form: typeof emptyForm) => ({
    policy_type: form.policy_type,
    carrier: form.carrier,
    policy_number: form.policy_number || null,
    effective_date: form.effective_date || null,
    expiration_date: form.expiration_date || null,
    coverage_limit: parseFloat(form.coverage_limit) || 0,
    premium: parseFloat(form.premium) || 0,
    notes: form.notes || null,
  })

  const handleSave = async () => {
    if (!formData.carrier.trim()) { alert('Carrier is required.'); return }
    setSaving(true)
    try {
      const payload = {
        ...buildPayload(formData),
        file_path: pendingFile?.path || null,
        file_name: pendingFile?.name || null,
        file_size: pendingFile?.size || null,
        file_type: pendingFile?.type || null,
      }
      const { error } = await supabase.from('insurance_policies').insert([payload])
      if (error) throw error
      setFormData(emptyForm)
      setPendingFile(null)
      setShowForm(false)
      loadPolicies()
    } catch (err: any) {
      console.error('Error saving policy:', err)
      alert('Failed to save policy: ' + (err?.message || 'unknown error'))
    } finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!selectedPolicy || !editFormData) return
    setSaving(true)
    try {
      const payload: Record<string, any> = buildPayload(editFormData)
      if (pendingFile) {
        payload.file_path = pendingFile.path
        payload.file_name = pendingFile.name
        payload.file_size = pendingFile.size
        payload.file_type = pendingFile.type
      }
      const { error } = await supabase.from('insurance_policies').update(payload).eq('id', selectedPolicy.id)
      if (error) throw error
      // Replaced document: drop the old object so the bucket doesn't accumulate orphans.
      if (pendingFile && selectedPolicy.file_path && selectedPolicy.file_path !== pendingFile.path) {
        await supabase.storage.from(BUCKET).remove([selectedPolicy.file_path])
      }
      setSelectedPolicy(null)
      setEditFormData(null)
      setPendingFile(null)
      loadPolicies()
    } catch (err: any) {
      console.error('Error updating policy:', err)
      alert('Failed to update policy: ' + (err?.message || 'unknown error'))
    } finally { setSaving(false) }
  }

  const handleDelete = async (policy: InsurancePolicy) => {
    if (!confirm(`Delete the ${policy.policy_type} policy from ${policy.carrier}? This also removes the uploaded document.`)) return
    try {
      const { error } = await supabase.from('insurance_policies').delete().eq('id', policy.id)
      if (error) throw error
      if (policy.file_path) await supabase.storage.from(BUCKET).remove([policy.file_path])
      setSelectedPolicy(null)
      setEditFormData(null)
      loadPolicies()
    } catch (err: any) {
      console.error('Error deleting policy:', err)
      alert('Failed to delete policy: ' + (err?.message || 'unknown error'))
    }
  }

  const openPolicy = (policy: InsurancePolicy) => {
    setSelectedPolicy(policy)
    setPendingFile(null)
    setEditFormData({
      policy_type: policy.policy_type,
      carrier: policy.carrier,
      policy_number: policy.policy_number || '',
      effective_date: policy.effective_date || '',
      expiration_date: policy.expiration_date || '',
      coverage_limit: policy.coverage_limit?.toString() || '',
      premium: policy.premium?.toString() || '',
      notes: policy.notes || '',
    })
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none'
  const inputStyle = { border: '1px solid var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }
  const labelCls = 'block text-xs font-medium mb-1'

  const renderForm = (
    form: typeof emptyForm,
    setForm: (f: typeof emptyForm) => void,
    onSave: () => void,
    onClose: () => void,
    title: string,
    existingFile?: InsurancePolicy,
  ) => (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-navy)' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Policy Type</label>
              <select value={form.policy_type} onChange={(e) => setForm({ ...form, policy_type: e.target.value })} className={inputCls} style={inputStyle}>
                {POLICY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Carrier</label>
              <input type="text" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="e.g. The Hartford" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Policy Number</label>
              <input type="text" value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Coverage Limit</label>
              <input type="number" step="0.01" value={form.coverage_limit} onChange={(e) => setForm({ ...form, coverage_limit: e.target.value })} placeholder="1000000" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Effective Date</label>
              <input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Expiration Date</label>
              <input type="date" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Annual Premium</label>
              <input type="number" step="0.01" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} style={inputStyle} />
          </div>

          {/* Document */}
          <div>
            <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Policy Document (PDF or image, max 20 MB)</label>
            <div className="rounded-lg p-4" style={{ border: '1px dashed var(--color-border)' }}>
              {pendingFile ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-sm truncate" style={{ color: 'var(--color-navy)' }}>{pendingFile.name}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-muted)' }}>{fmtSize(pendingFile.size)}</span>
                  </div>
                  <button onClick={() => setPendingFile(null)} className="text-xs font-medium" style={{ color: 'var(--color-danger, #dc2626)' }}>Remove</button>
                </div>
              ) : existingFile?.file_path ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-sm truncate" style={{ color: 'var(--color-navy)' }}>{existingFile.file_name || 'Attached document'}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-muted)' }}>{fmtSize(existingFile.file_size)}</span>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs font-medium disabled:opacity-50" style={{ color: 'var(--color-primary)' }}>
                    {uploading ? 'Uploading...' : 'Replace'}
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-50" style={{ color: 'var(--color-muted)' }}>
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Choose a file to upload'}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          {selectedPolicy && (
            <button onClick={() => handleDelete(selectedPolicy)} className="mr-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#dc2626' }}>
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>Cancel</button>
          <button onClick={onSave} disabled={saving || uploading} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50" style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
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
        <p className="text-gray-600 mb-6">
          Run <code className="text-xs px-1.5 py-0.5 rounded bg-gray-100">supabase/migrations/20260805_insurance_policies.sql</code> in your Supabase SQL Editor.
          It creates the table, its row-level security policies, and the private <code className="text-xs px-1.5 py-0.5 rounded bg-gray-100">insurance-policies</code> storage bucket.
        </p>
        <button onClick={() => { setTableReady(true); setLoading(true); loadPolicies() }} className="mt-2 px-6 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
          I&apos;ve run the SQL — Retry
        </button>
      </div>
    )
  }

  const activeCount = policies.filter((p) => { const s = policyStatus(p.expiration_date); return s.days === null || s.days >= 0 }).length
  const expiringCount = policies.filter((p) => { const s = policyStatus(p.expiration_date); return s.days !== null && s.days >= 0 && s.days <= 30 }).length
  const expiredCount = policies.filter((p) => { const s = policyStatus(p.expiration_date); return s.days !== null && s.days < 0 }).length
  const totalPremium = policies.reduce((s, p) => s + (p.premium || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Insurance Policies</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>Certificates of insurance, coverage limits, and renewal dates</p>
        </div>
        <button
          onClick={() => { setFormData(emptyForm); setPendingFile(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}
        >
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Policies', value: activeCount.toString() },
          { label: 'Expiring in 30 Days', value: expiringCount.toString() },
          { label: 'Expired', value: expiredCount.toString() },
          { label: 'Total Annual Premium', value: fmt(totalPremium) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Policies Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Shield className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-400">No policies yet. Add your general liability, workers comp, or auto coverage.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                <tr>
                  {['Policy Type', 'Carrier', 'Policy #', 'Coverage', 'Effective', 'Expires', 'Status', 'Document', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--color-navy)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const status = policyStatus(policy.expiration_date)
                  return (
                    <tr key={policy.id} style={{ borderTop: '1px solid var(--color-border)' }} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: 'var(--color-navy)' }}>{policy.policy_type}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-navy)' }}>{policy.carrier}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{policy.policy_number || '—'}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--color-navy)' }}>{policy.coverage_limit ? fmt(policy.coverage_limit) : '—'}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>{fmtDate(policy.effective_date)}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>{fmtDate(policy.expiration_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.tone}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {policy.file_path ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openFile(policy, false)}
                              disabled={busyFileId === policy.id}
                              title={policy.file_name || 'View document'}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium disabled:opacity-50 hover:bg-gray-100"
                              style={{ color: 'var(--color-primary)' }}
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            <button
                              onClick={() => openFile(policy, true)}
                              disabled={busyFileId === policy.id}
                              title="Download document"
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium disabled:opacity-50 hover:bg-gray-100"
                              style={{ color: 'var(--color-primary)' }}
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>No file</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openPolicy(policy)} className="text-xs font-medium" style={{ color: 'var(--color-navy)' }}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && renderForm(formData, setFormData, handleSave, () => { setShowForm(false); setPendingFile(null) }, 'Add Insurance Policy')}
      {selectedPolicy && editFormData && renderForm(
        editFormData,
        (f) => setEditFormData(f),
        handleUpdate,
        () => { setSelectedPolicy(null); setEditFormData(null); setPendingFile(null) },
        'Edit Insurance Policy',
        selectedPolicy,
      )}
    </div>
  )
}
