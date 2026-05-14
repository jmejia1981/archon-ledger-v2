'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Trash2, X, Save } from 'lucide-react'

interface Expense {
  id: string
  vendor: string
  project_id: string
  tax_category?: string
  amount: number
  date: string
  receipt_url?: string
  approval_status: 'pending' | 'approved' | 'rejected'
  description: string
  notes?: string
  is_monthly?: boolean
  monthly_end_date?: string
}

interface Project {
  id: string
  project_name: string
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewExpenseForm, setShowNewExpenseForm] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [editFormData, setEditFormData] = useState<typeof formData | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    projectId: '',
    taxCategory: '',
    amount: '',
    receiptUrl: '',
    approvalStatus: 'pending' as 'pending' | 'approved' | 'rejected',
    description: '',
    notes: '',
    isMonthly: false,
    monthlyEndDate: '',
  })

  const supabase = createClient()

  // Load expenses and projects
  useEffect(() => {
    const loadData = async () => {
      try {
        const [expensesData, projectsData] = await Promise.all([
          supabase.from('expenses').select('*'),
          supabase.from('projects').select('id, project_name'),
        ])

        setExpenses(expensesData.data || [])
        setProjects(projectsData.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Filter and search expenses
  useEffect(() => {
    let filtered = expenses

    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => e.approval_status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredExpenses(filtered)
  }, [expenses, statusFilter, searchTerm])

  // Handle create expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.vendor || !formData.amount || !formData.description) {
      alert('Vendor, amount, and description are required')
      return
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([
          {
            vendor: formData.vendor,
            project_id: formData.projectId || null,
            category_group: formData.projectId ? 'direct-project-costs' : 'company-overhead',
            category: 'General',
            tax_category: formData.taxCategory || null,
            amount: parseFloat(formData.amount),
            date: formData.date,
            receipt_url: formData.receiptUrl || null,
            approval_status: formData.approvalStatus,
            description: formData.description,
            notes: formData.notes || null,
            is_monthly: formData.isMonthly,
            monthly_end_date: formData.isMonthly ? formData.monthlyEndDate : null,
          },
        ])
        .select()

      if (error) throw new Error(`Failed to create: ${error.message}`)

      if (data) {
        setExpenses([...expenses, ...data])
        setFormData({
          date: new Date().toISOString().split('T')[0],
          vendor: '',
          projectId: '',
          taxCategory: '',
          amount: '',
          receiptUrl: '',
          approvalStatus: 'pending',
          description: '',
          notes: '',
          isMonthly: false,
          monthlyEndDate: '',
        })
        setShowNewExpenseForm(false)
        alert('Expense created successfully!')
      }
    } catch (error) {
      console.error('Error creating expense:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create expense'}`)
    }
  }

  // Handle delete expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw new Error(`Failed to delete: ${error.message}`)
      setExpenses(expenses.filter((e) => e.id !== id))
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete expense'}`)
    }
  }

  const handleOpenExpense = (expense: Expense) => {
    setSelectedExpense(expense)
    setEditFormData({
      date: expense.date,
      vendor: expense.vendor,
      projectId: expense.project_id || '',
      taxCategory: expense.tax_category || '',
      amount: expense.amount.toString(),
      receiptUrl: expense.receipt_url || '',
      approvalStatus: expense.approval_status,
      description: expense.description,
      notes: expense.notes || '',
      isMonthly: expense.is_monthly || false,
      monthlyEndDate: expense.monthly_end_date || '',
    })
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedExpense || !editFormData) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          vendor: editFormData.vendor,
          project_id: editFormData.projectId || null,
          category_group: editFormData.projectId ? 'direct-project-costs' : 'company-overhead',
          tax_category: editFormData.taxCategory || null,
          amount: parseFloat(editFormData.amount),
          date: editFormData.date,
          receipt_url: editFormData.receiptUrl || null,
          approval_status: editFormData.approvalStatus,
          description: editFormData.description,
          notes: editFormData.notes || null,
          is_monthly: editFormData.isMonthly,
          monthly_end_date: editFormData.isMonthly ? editFormData.monthlyEndDate : null,
        })
        .eq('id', selectedExpense.id)

      if (error) throw error

      setExpenses(expenses.map((exp) =>
        exp.id === selectedExpense.id
          ? {
              ...exp,
              vendor: editFormData.vendor,
              project_id: editFormData.projectId || '',
              tax_category: editFormData.taxCategory || undefined,
              amount: parseFloat(editFormData.amount),
              date: editFormData.date,
              receipt_url: editFormData.receiptUrl || undefined,
              approval_status: editFormData.approvalStatus,
              description: editFormData.description,
              notes: editFormData.notes || undefined,
              is_monthly: editFormData.isMonthly,
              monthly_end_date: editFormData.monthlyEndDate || undefined,
            }
          : exp
      ))
      setSelectedExpense(null)
      setEditFormData(null)
    } catch (error) {
      console.error('Error updating expense:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to update expense'}`)
    } finally {
      setSaving(false)
    }
  }

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.project_name || 'Overhead'
  }

  const statusColors: Record<string, string> = {
    approved: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)

  const taxCategoryOptions = [
    'Advertising (Line 8)',
    'Car & Truck Expenses (Line 9)',
    'Contract Labor (Line 11)',
    'Depreciation (Line 13)',
    'Insurance (Line 15)',
    'Legal & Professional Services (Line 17)',
    'Office Expense (Line 18)',
    'Rent or Lease (Line 20)',
    'Repairs & Maintenance (Line 21)',
    'Supplies & Materials (Line 22)',
    'Taxes & Licenses (Line 23)',
    'Travel (Line 24a)',
    'Meals — 50% deductible (Line 24b)',
    'Utilities (Line 25)',
    'Wages (Line 26)',
    'Other Expense (Line 27a)',
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Expenses</h1>
          <p style={{ color: 'var(--color-muted)' }}>Track all project and operational expenses</p>
        </div>
        <button
          onClick={() => setShowNewExpenseForm(true)}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <Plus className="w-5 h-5" />
          New Expense
        </button>
      </div>

      {/* New Expense Form Modal */}
      {showNewExpenseForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Record New Expense</h2>
              <button onClick={() => setShowNewExpenseForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Vendor *</label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="Supplier name"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Project</label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="">No project (overhead)</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.project_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Tax Category (Schedule C)</label>
                <select
                  value={formData.taxCategory}
                  onChange={(e) => setFormData({ ...formData, taxCategory: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="">— Select tax category —</option>
                  {taxCategoryOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the expense"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition resize-none"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Approval Status</label>
                <select
                  value={formData.approvalStatus}
                  onChange={(e) => setFormData({ ...formData, approvalStatus: e.target.value as 'pending' | 'approved' | 'rejected' })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isMonthly"
                  checked={formData.isMonthly}
                  onChange={(e) => setFormData({ ...formData, isMonthly: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isMonthly" className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
                  Recurring Monthly Expense
                </label>
              </div>

              {formData.isMonthly && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Monthly End Date</label>
                  <input
                    type="date"
                    value={formData.monthlyEndDate}
                    onChange={(e) => setFormData({ ...formData, monthlyEndDate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Receipt URL</label>
                <input
                  type="url"
                  value={formData.receiptUrl}
                  onChange={(e) => setFormData({ ...formData, receiptUrl: e.target.value })}
                  placeholder="https://example.com/receipt.pdf"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewExpenseForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg hover:opacity-80 transition"
                  style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                  style={{ backgroundColor: 'var(--color-navy)' }}
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Expenses</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Number of Expenses</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{filteredExpenses.length}</p>
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Avg Expense</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>
              {formatCurrency(filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border appearance-none pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--color-muted)' }}>
          <p>Loading expenses...</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <p style={{ color: 'var(--color-muted)' }}>No expenses found. Record your first expense to get started!</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-x-auto" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <table className="w-full min-w-[640px]">
            <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Vendor</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Project</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Tax Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Description</th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  style={{ borderBottom: `1px solid var(--color-border)`, cursor: 'pointer' }}
                  className="hover:bg-gray-50 transition"
                  onDoubleClick={() => handleOpenExpense(expense)}
                >
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(expense.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{expense.vendor}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{getProjectName(expense.project_id)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>
                    {expense.tax_category ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#e8f0fe', color: '#1a3a6b' }}>
                        {expense.tax_category}
                      </span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)', maxWidth: '200px' }}>
                    <span className="line-clamp-2">{expense.description}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[expense.approval_status]}`}>
                      {expense.approval_status.charAt(0).toUpperCase() + expense.approval_status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense.id) }}
                      className="hover:opacity-80 transition p-1"
                      style={{ color: 'var(--color-destructive)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Expense Modal */}
      {selectedExpense && editFormData && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>Edit Expense</h2>
              <button onClick={() => { setSelectedExpense(null); setEditFormData(null) }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Date</label>
                  <input type="date" value={editFormData.date} onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Amount *</label>
                  <input type="number" step="0.01" value={editFormData.amount} onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }} required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Vendor *</label>
                <input type="text" value={editFormData.vendor} onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }} required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Project</label>
                <select value={editFormData.projectId} onChange={(e) => setEditFormData({ ...editFormData, projectId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>
                  <option value="">No project (overhead)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Tax Category (Schedule C)</label>
                <select value={editFormData.taxCategory} onChange={(e) => setEditFormData({ ...editFormData, taxCategory: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>
                  <option value="">— Select tax category —</option>
                  {taxCategoryOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Description *</label>
                <textarea value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ borderColor: 'var(--color-border)' }} rows={2} required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Approval Status</label>
                <select value={editFormData.approvalStatus} onChange={(e) => setEditFormData({ ...editFormData, approvalStatus: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="editIsMonthly" checked={editFormData.isMonthly} onChange={(e) => setEditFormData({ ...editFormData, isMonthly: e.target.checked })} className="rounded" />
                <label htmlFor="editIsMonthly" className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>Recurring Monthly</label>
              </div>

              {editFormData.isMonthly && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Monthly End Date</label>
                  <input type="date" value={editFormData.monthlyEndDate} onChange={(e) => setEditFormData({ ...editFormData, monthlyEndDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Receipt URL</label>
                <input type="url" value={editFormData.receiptUrl} onChange={(e) => setEditFormData({ ...editFormData, receiptUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }} placeholder="https://" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Notes</label>
                <textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ borderColor: 'var(--color-border)' }} rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setSelectedExpense(null); setEditFormData(null) }}
                  className="flex-1 px-4 py-2 rounded-lg border font-medium hover:bg-gray-50 transition"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--color-navy)' }}>
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
