'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Trash2, FileText, CheckCircle } from 'lucide-react'

interface PayrollRecord {
  id: string
  payroll_period_start: string
  payroll_period_end: string
  employee_id: string
  regular_hours: number
  overtime_hours: number
  gross_pay: number
  taxes: number
  benefits: number
  reimbursements: number
  total_employer_cost: number
  status: string
}

interface Employee {
  id: string
  name: string
  hourly_rate: number
}

export default function PayrollPage() {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<PayrollRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewPayrollForm, setShowNewPayrollForm] = useState(false)
  const [formData, setFormData] = useState({
    payroll_period_start: '',
    payroll_period_end: '',
    employee_id: '',
    regular_hours: '',
    overtime_hours: '',
    gross_pay: '',
    taxes: '',
    benefits: '',
    reimbursements: '',
    status: 'pending',
  })

  const supabase = createClient()

  // Load payroll records and employees
  useEffect(() => {
    const loadData = async () => {
      try {
        const [payrollData, employeesData] = await Promise.all([
          supabase.from('payroll').select('*'),
          supabase.from('employees').select('id, name, first_name, last_name, hourly_rate'),
        ])

        // Map employees to handle both old (name) and new (first_name + last_name) formats
        const formattedEmployees = (employeesData.data || []).map((emp: any) => ({
          id: emp.id,
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          hourly_rate: emp.hourly_rate,
        }))

        console.log('Payroll records:', payrollData.data)
        console.log('Employees:', formattedEmployees)
        setPayrollRecords(payrollData.data || [])
        setEmployees(formattedEmployees)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Filter and search payroll records
  useEffect(() => {
    let filtered = payrollRecords

    if (statusFilter !== 'all') {
      filtered = filtered.filter((record) => record.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredRecords(filtered)
  }, [payrollRecords, statusFilter, searchTerm])

  // Handle create payroll record
  const handleCreatePayrollRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employee_id || !formData.payroll_period_start) {
      alert('Employee and payroll period start date are required')
      return
    }

    try {
      console.log('Creating payroll record:', formData)
      const grossPay = parseFloat(formData.gross_pay) || 0
      const taxes = parseFloat(formData.taxes) || grossPay * 0.18
      const benefits = parseFloat(formData.benefits) || 0
      const reimbursements = parseFloat(formData.reimbursements) || 0
      const totalEmployerCost = grossPay + taxes + benefits + reimbursements

      const { data, error } = await supabase
        .from('payroll')
        .insert([
          {
            payroll_period_start: formData.payroll_period_start,
            payroll_period_end: formData.payroll_period_end,
            employee_id: formData.employee_id,
            regular_hours: parseFloat(formData.regular_hours) || 0,
            overtime_hours: parseFloat(formData.overtime_hours) || 0,
            gross_pay: grossPay,
            taxes: taxes,
            benefits: benefits,
            reimbursements: reimbursements,
            total_employer_cost: totalEmployerCost,
            status: formData.status,
          },
        ])
        .select()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to create: ${error.message}`)
      }

      console.log('Payroll record created successfully:', data)
      if (data) {
        setPayrollRecords([...payrollRecords, ...data])
        setFormData({
          payroll_period_start: '',
          payroll_period_end: '',
          employee_id: '',
          regular_hours: '',
          overtime_hours: '',
          gross_pay: '',
          taxes: '',
          benefits: '',
          reimbursements: '',
          status: 'pending',
        })
        setShowNewPayrollForm(false)
        alert('Payroll record created successfully!')
      }
    } catch (error) {
      console.error('Error creating payroll record:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create payroll record'}`)
    }
  }

  // Handle delete payroll record
  const handleDeletePayrollRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payroll record?')) return

    try {
      const { error } = await supabase.from('payroll').delete().eq('id', id)

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to delete: ${error.message}`)
      }

      setPayrollRecords(payrollRecords.filter((r) => r.id !== id))
      alert('Payroll record deleted successfully!')
    } catch (error) {
      console.error('Error deleting payroll record:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete payroll record'}`)
    }
  }

  // Handle approve payroll record
  const handleApprovePayrollRecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payroll')
        .update({ status: 'approved' })
        .eq('id', id)

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to approve: ${error.message}`)
      }

      setPayrollRecords(
        payrollRecords.map((r) =>
          r.id === id ? { ...r, status: 'approved' } : r
        )
      )
      alert('Payroll record approved!')
    } catch (error) {
      console.error('Error approving payroll record:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to approve payroll record'}`)
    }
  }

  const getEmployeeName = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.name || 'Unknown'
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    paid: 'bg-blue-100 text-blue-800',
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const totalGrossPay = filteredRecords.reduce((sum, r) => sum + r.gross_pay, 0)
  const totalTaxes = filteredRecords.reduce((sum, r) => sum + r.taxes, 0)
  const totalEmployerCost = filteredRecords.reduce((sum, r) => sum + r.total_employer_cost, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Payroll</h1>
          <p style={{ color: 'var(--color-muted)' }}>Manage payroll periods and employee payments</p>
        </div>
        <button
          onClick={() => setShowNewPayrollForm(true)}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <Plus className="w-5 h-5" />
          New Payroll
        </button>
      </div>

      {/* New Payroll Form Modal */}
      {showNewPayrollForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>Create Payroll Record</h2>
            <form onSubmit={handleCreatePayrollRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee *
                </label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  required
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} (${emp.hourly_rate}/hr)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period Start *
                  </label>
                  <input
                    type="date"
                    value={formData.payroll_period_start}
                    onChange={(e) => setFormData({ ...formData, payroll_period_start: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={formData.payroll_period_end}
                    onChange={(e) => setFormData({ ...formData, payroll_period_end: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Regular Hours
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.regular_hours}
                    onChange={(e) => setFormData({ ...formData, regular_hours: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Overtime Hours
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.overtime_hours}
                    onChange={(e) => setFormData({ ...formData, overtime_hours: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gross Pay
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.gross_pay}
                  onChange={(e) => setFormData({ ...formData, gross_pay: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taxes
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.taxes}
                    onChange={(e) => setFormData({ ...formData, taxes: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Benefits
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.benefits}
                    onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reimbursements
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.reimbursements}
                    onChange={(e) => setFormData({ ...formData, reimbursements: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewPayrollForm(false)}
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
                  Create Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Gross Pay</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(totalGrossPay)}</p>
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Taxes</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(totalTaxes)}</p>
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Employer Cost</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(totalEmployerCost)}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search payroll records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-10"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Payroll Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading payroll records...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
          <p className="text-gray-600">No payroll records found. Create your first payroll record to get started!</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Employee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Period</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Hours</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Gross Pay</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Taxes</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Benefits</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Employer Cost</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} style={{ borderBottom: `1px solid var(--color-border)` }} className="hover:opacity-75">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{getEmployeeName(record.employee_id)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(record.payroll_period_start)} to {formatDate(record.payroll_period_end)}
                  </td>
                  <td className="px-6 py-4 text-sm text-center text-gray-900">
                    {(record.regular_hours + record.overtime_hours).toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    {formatCurrency(record.gross_pay)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    {formatCurrency(record.taxes)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    {formatCurrency(record.benefits)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    {formatCurrency(record.total_employer_cost)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[record.status]}`}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    {record.status === 'pending' && (
                      <button
                        onClick={() => handleApprovePayrollRecord(record.id)}
                        className="text-green-600 hover:text-green-900 transition"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button className="text-blue-600 hover:text-blue-900 transition" title="Generate Slip">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePayrollRecord(record.id)}
                      className="text-red-600 hover:text-red-900 transition"
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
    </div>
  )
}
