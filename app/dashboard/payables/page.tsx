'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Trash2, X, Save, CheckCircle, AlertCircle, Clock, DollarSign } from 'lucide-react'

interface VendorBill {
  id: string
  bill_number: string
  vendor: string
  project_id?: string
  project_name?: string
  issue_date: string
  due_date: string
  amount: number
  amount_paid: number
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  category: string
  tax_category?: string
  description?: string
  notes?: string
}

interface Project {
  id: string
  project_name: string
}

const TAX_CATEGORIES = [
  'Advertising (Line 8)',
  'Car & Truck (Line 9)',
  'Contract Labor (Line 11)',
  'Depreciation (Line 13)',
  'Insurance (Line 15)',
  'Legal & Professional (Line 17)',
  'Office Expense (Line 18)',
  'Rent or Lease (Line 20)',
  'Repairs & Maintenance (Line 21)',
  'Supplies & Materials (Line 22)',
  'Taxes & Licenses (Line 23)',
  'Travel (Line 24a)',
  'Meals 50% (Line 24b)',
  'Utilities (Line 25)',
  'Wages (Line 26)',
  'Other (Line 27a)',
]

const CATEGORIES = [
  'Materials',
  'Subcontractors',
  'Equipment Rental',
  'Labor',
  'Permits & Fees',
  'Insurance',
  'Office Supplies',
  'Utilities',
  'Professional Services',
  'Rent',
  'Other',
]

const emptyForm = {
  bill_number: '',
  vendor: '',
  project_id: '',
  issue_date: new Date().toISOString().split('T')[0],
  due_date: '',
  amount: '',
  amount_paid: '0',
  category: 'Materials',
  tax_category: '',
  description: '',
  notes: '',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function statusBadge(bill: VendorBill) {
  const balance = bill.amount - bill.amount_paid
  const overdue = new Date(bill.due_date) < new Date() && balance > 0

  let label: string = bill.status
  let bg = '#f3f4f6'
  let color = '#374151'

  if (bill.status === 'paid') {
    label = 'Paid'; bg = '#d1fae5'; color = '#065f46'
  } else if (overdue) {
    label = 'Overdue'; bg = '#fee2e2'; color = '#991b1b'
  } else if (bill.status === 'partial') {
    label = 'Partial'; bg = '#fef3c7'; color = '#92400e'
  } else {
    label = 'Unpaid'; bg = '#dbeafe'; color = '#1e40af'
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  )
}

export default function PayablesPage() {
  const [bills, setBills] = useState<VendorBill[]>([])
  const [filtered, setFiltered] = useState<VendorBill[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [formData, setFormData] = useState(emptyForm)
  const [editFormData, setEditFormData] = useState<typeof emptyForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [tableReady, setTableReady] = useState(true)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    try {
      const [billsRes, projectsRes] = await Promise.all([
        supabase.from('vendor_bills').select('*').order('due_date', { ascending: true }),
        supabase.from('projects').select('id, project_name'),
      ])

      if (billsRes.error?.code === '42P01') {
        setTableReady(false)
        setLoading(false)
        return
      }

      const billData: VendorBill[] = (billsRes.data || []).map((b: any) => {
        const balance = b.amount - b.amount_paid
        const overdue = new Date(b.due_date) < new Date() && balance > 0 && b.status !== 'paid'
        return {
          ...b,
          status: b.amount_paid >= b.amount ? 'paid' : b.amount_paid > 0 ? 'partial' : overdue ? 'overdue' : 'unpaid',
        }
      })

      setBills(billData)
      setProjects(projectsRes.data || [])
    } catch {
      setTableReady(false)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    let result = bills
    if (statusFilter !== 'all') {
      result = result.filter((b) => {
        const balance = b.amount - b.amount_paid
        const overdue = new Date(b.due_date) < new Date() && balance > 0 && b.status !== 'paid'
        if (statusFilter === 'unpaid') return b.status === 'unpaid' && !overdue
        if (statusFilter === 'partial') return b.status === 'partial'
        if (statusFilter === 'overdue') return overdue
        if (statusFilter === 'paid') return b.status === 'paid'
        return true
      })
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter(
        (b) =>
          b.vendor.toLowerCase().includes(q) ||
          b.bill_number.toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [bills, statusFilter, searchTerm])

  const totalPayable = bills.filter((b) => b.status !== 'paid').reduce((s, b) => s + (b.amount - b.amount_paid), 0)
  const totalOverdue = bills.filter((b) => {
    const balance = b.amount - b.amount_paid
    return new Date(b.due_date) < new Date() && balance > 0 && b.status !== 'paid'
  }).reduce((s, b) => s + (b.amount - b.amount_paid), 0)
  const dueThisWeek = bills.filter((b) => {
    const due = new Date(b.due_date)
    const now = new Date()
    const week = new Date(now); week.setDate(now.getDate() + 7)
    return due >= now && due <= week && b.status !== 'paid'
  }).reduce((s, b) => s + (b.amount - b.amount_paid), 0)
  const paidThisMonth = bills.filter((b) => {
    const due = new Date(b.due_date)
    const now = new Date()
    return b.status === 'paid' && due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear()
  }).reduce((s, b) => s + b.amount_paid, 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        bill_number: formData.bill_number,
        vendor: formData.vendor,
        project_id: formData.project_id || null,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        amount: parseFloat(formData.amount) || 0,
        amount_paid: parseFloat(formData.amount_paid) || 0,
        category: formData.category,
        tax_category: formData.tax_category || null,
        description: formData.description,
        notes: formData.notes,
      }
      const { error } = await supabase.from('vendor_bills').insert([payload])
      if (error) throw error
      setFormData(emptyForm)
      setShowForm(false)
      loadData()
    } catch (err) {
      console.error('Error saving bill:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedBill || !editFormData) return
    setSaving(true)
    try {
      const payload = {
        bill_number: editFormData.bill_number,
        vendor: editFormData.vendor,
        project_id: editFormData.project_id || null,
        issue_date: editFormData.issue_date,
        due_date: editFormData.due_date,
        amount: parseFloat(editFormData.amount) || 0,
        amount_paid: parseFloat(editFormData.amount_paid) || 0,
        category: editFormData.category,
        tax_category: editFormData.tax_category || null,
        description: editFormData.description,
        notes: editFormData.notes,
      }
      const { error } = await supabase.from('vendor_bills').update(payload).eq('id', selectedBill.id)
      if (error) throw error
      setSelectedBill(null)
      setEditFormData(null)
      loadData()
    } catch (err) {
      console.error('Error updating bill:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor bill?')) return
    await supabase.from('vendor_bills').delete().eq('id', id)
    loadData()
  }

  const handleRecordPayment = async () => {
    if (!selectedBill) return
    const paid = parseFloat(payAmount) || 0
    const newPaid = Math.min(selectedBill.amount_paid + paid, selectedBill.amount)
    await supabase.from('vendor_bills').update({ amount_paid: newPaid }).eq('id', selectedBill.id)
    setShowPayModal(false)
    setPayAmount('')
    setSelectedBill(null)
    loadData()
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
  const inputStyle = { border: '1px solid var(--color-border)', backgroundColor: 'white', focusRingColor: 'var(--color-gold)' }
  const labelClass = "block text-xs font-medium mb-1"

  const BillForm = ({ data, onChange, onSave, onCancel, title }: {
    data: typeof emptyForm
    onChange: (d: typeof emptyForm) => void
    onSave: () => void
    onCancel: () => void
    title: string
  }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-navy)' }}>{title}</h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="bill_number">Bill #</label>
            <input id="bill_number" name="bill_number" type="text" className={inputClass} style={inputStyle}
              value={data.bill_number} onChange={(e) => onChange({ ...data, bill_number: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="vendor">Vendor *</label>
            <input id="vendor" name="vendor" type="text" className={inputClass} style={inputStyle}
              value={data.vendor} onChange={(e) => onChange({ ...data, vendor: e.target.value })} required />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="issue_date">Issue Date</label>
            <input id="issue_date" name="issue_date" type="date" className={inputClass} style={inputStyle}
              value={data.issue_date} onChange={(e) => onChange({ ...data, issue_date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="due_date">Due Date *</label>
            <input id="due_date" name="due_date" type="date" className={inputClass} style={inputStyle}
              value={data.due_date} onChange={(e) => onChange({ ...data, due_date: e.target.value })} required />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="amount">Amount *</label>
            <input id="amount" name="amount" type="number" step="0.01" min="0" className={inputClass} style={inputStyle}
              value={data.amount} onChange={(e) => onChange({ ...data, amount: e.target.value })} required />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="amount_paid">Amount Paid</label>
            <input id="amount_paid" name="amount_paid" type="number" step="0.01" min="0" className={inputClass} style={inputStyle}
              value={data.amount_paid} onChange={(e) => onChange({ ...data, amount_paid: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="category">Category</label>
            <select id="category" name="category" className={inputClass} style={inputStyle}
              value={data.category} onChange={(e) => onChange({ ...data, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="tax_category">IRS Schedule C</label>
            <select id="tax_category" name="tax_category" className={inputClass} style={inputStyle}
              value={data.tax_category} onChange={(e) => onChange({ ...data, tax_category: e.target.value })}>
              <option value="">— Select —</option>
              {TAX_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="project_id">Project (optional)</label>
            <select id="project_id" name="project_id" className={inputClass} style={inputStyle}
              value={data.project_id} onChange={(e) => onChange({ ...data, project_id: e.target.value })}>
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="description">Description</label>
            <input id="description" name="description" type="text" className={inputClass} style={inputStyle}
              value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} style={{ color: 'var(--color-navy)' }} htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} className={inputClass} style={inputStyle}
              value={data.notes} onChange={(e) => onChange({ ...data, notes: e.target.value })} />
          </div>
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
        <p className="text-gray-600 mb-6">Run the following SQL in your Supabase SQL Editor to create the vendor bills table:</p>
        <pre className="text-left text-xs p-4 rounded-lg overflow-x-auto" style={{ backgroundColor: '#1e293b', color: '#e2e8f0' }}>{`CREATE TABLE IF NOT EXISTS vendor_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT,
  vendor TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  issue_date DATE,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT,
  tax_category TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vendor_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON vendor_bills FOR ALL USING (true) WITH CHECK (true);`}</pre>
        <button onClick={() => { setTableReady(true); loadData() }} className="mt-6 px-6 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
          I&apos;ve run the SQL — Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Accounts Payable</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>Track vendor bills and outstanding payments</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}
        >
          <Plus className="w-4 h-4" /> Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Payable', value: fmt(totalPayable), icon: DollarSign, color: 'var(--color-navy)' },
          { label: 'Overdue', value: fmt(totalOverdue), icon: AlertCircle, color: '#dc2626' },
          { label: 'Due This Week', value: fmt(dueThisWeek), icon: Clock, color: '#f59e0b' },
          { label: 'Paid This Month', value: fmt(paidThisMonth), icon: CheckCircle, color: '#10b981' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3" style={{ border: '1px solid var(--color-border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          <input
            type="text"
            placeholder="Search vendor, bill #, description..."
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'white' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'unpaid', 'partial', 'overdue', 'paid'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                backgroundColor: statusFilter === s ? 'var(--color-navy)' : 'transparent',
                color: statusFilter === s ? 'white' : 'var(--color-navy)',
                border: '1px solid var(--color-border)',
              }}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)' }}>
              <tr>
                {['Bill #', 'Vendor', 'Category', 'Issue Date', 'Due Date', 'Amount', 'Balance Due', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>
                    No vendor bills found
                  </td>
                </tr>
              ) : filtered.map((bill) => (
                <tr
                  key={bill.id}
                  className="border-t hover:bg-gray-50 transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--color-border)' }}
                  onClick={() => {
                    setSelectedBill(bill)
                    setEditFormData({
                      bill_number: bill.bill_number || '',
                      vendor: bill.vendor,
                      project_id: bill.project_id || '',
                      issue_date: bill.issue_date || '',
                      due_date: bill.due_date,
                      amount: bill.amount.toString(),
                      amount_paid: bill.amount_paid.toString(),
                      category: bill.category,
                      tax_category: bill.tax_category || '',
                      description: bill.description || '',
                      notes: bill.notes || '',
                    })
                  }}
                >
                  <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--color-navy)' }}>
                    {bill.bill_number || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                    {bill.vendor}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                    {bill.category}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                    {bill.issue_date ? new Date(bill.issue_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                    {new Date(bill.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                    {fmt(bill.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: bill.amount - bill.amount_paid > 0 ? '#dc2626' : '#10b981' }}>
                    {fmt(bill.amount - bill.amount_paid)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(bill)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {bill.status !== 'paid' && (
                        <button
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: '#d1fae5', color: '#065f46' }}
                          onClick={() => { setSelectedBill(bill); setShowPayModal(true) }}
                        >
                          Pay
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(bill.id)}
                        className="p-1 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Bill Modal */}
      {showForm && (
        <BillForm
          data={formData}
          onChange={setFormData}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setFormData(emptyForm) }}
          title="Add Vendor Bill"
        />
      )}

      {/* Edit Bill Modal */}
      {selectedBill && editFormData && !showPayModal && (
        <BillForm
          data={editFormData}
          onChange={setEditFormData}
          onSave={handleUpdate}
          onCancel={() => { setSelectedBill(null); setEditFormData(null) }}
          title="Edit Vendor Bill"
        />
      )}

      {/* Record Payment Modal */}
      {showPayModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--color-navy)' }}>Record Payment</h2>
              <button onClick={() => { setShowPayModal(false); setSelectedBill(null) }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{selectedBill.vendor}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  Balance due: {fmt(selectedBill.amount - selectedBill.amount_paid)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-navy)' }} htmlFor="pay_amount">Payment Amount</label>
                <input
                  id="pay_amount"
                  name="pay_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedBill.amount - selectedBill.amount_paid}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ border: '1px solid var(--color-border)' }}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Max: ${fmt(selectedBill.amount - selectedBill.amount_paid)}`}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPayAmount((selectedBill.amount - selectedBill.amount_paid).toString())}
                  className="flex-1 py-2 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                >
                  Pay in Full
                </button>
                <button
                  onClick={handleRecordPayment}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}
                >
                  Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
