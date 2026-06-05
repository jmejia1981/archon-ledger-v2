'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, DollarSign, Clock, Users } from 'lucide-react'

interface LaborEntry {
  id: string
  employee_id: string
  project_id: string
  date: string
  regular_hours: number
  overtime_hours: number
}

interface Employee {
  id: string
  name: string
  hourly_rate: number
}

interface PayrollRecord {
  id: string
  payroll_period_start: string
  payroll_period_end: string
  employee_id: string
  regular_hours: number
  overtime_hours: number
  gross_pay: number
  taxes: number
  reimbursements: number
  total_employer_cost: number
  status: string
  payment_method: string
}

// Thursday of current week (Thu–Wed pay cycle)
function getWeekStart(d = new Date()) {
  const day = d.getDay() // 0=Sun,1=Mon,...,4=Thu,...,6=Sat
  const diff = day >= 4 ? -(day - 4) : -(day + 3)
  const thu = new Date(d)
  thu.setDate(d.getDate() + diff)
  return thu.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
}

const PAYMENT_METHODS = ['Check', 'Direct Deposit', 'Cash', 'Venmo', 'Zelle']

const supabase = createClient()

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>([])
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Week selector
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const weekEnd = addDays(weekStart, 6)

  // Payment method per employee for current week
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({})

  // Status filter for history
  const [statusFilter, setStatusFilter] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [empRes, laborRes, payrollRes] = await Promise.all([
      supabase.from('employees').select('id, name, first_name, last_name, hourly_rate'),
      supabase.from('labor_entries').select('id, employee_id, project_id, date, regular_hours, overtime_hours'),
      supabase.from('payroll').select('*').order('payroll_period_start', { ascending: false }),
    ])

    const emps: Employee[] = (empRes.data || []).map((e: any) => ({
      id: e.id,
      name: e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
      hourly_rate: e.hourly_rate || 0,
    }))

    setEmployees(emps)
    setLaborEntries(laborRes.data || [])
    setPayrollRecords(payrollRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Labor entries for selected week
  const weekEntries = laborEntries.filter(e => e.date >= weekStart && e.date <= weekEnd)

  // Group by employee
  type EmpWeekRow = {
    employee: Employee
    regularHours: number
    overtimeHours: number
    regularPay: number
    overtimePay: number
    grossPay: number
    alreadyApproved: boolean
  }

  const weekRows: EmpWeekRow[] = employees
    .map(emp => {
      const entries = weekEntries.filter(e => e.employee_id === emp.id)
      if (entries.length === 0) return null
      const regularHours = entries.reduce((s, e) => s + (e.regular_hours || 0), 0)
      const overtimeHours = entries.reduce((s, e) => s + (e.overtime_hours || 0), 0)
      const regularPay = regularHours * emp.hourly_rate
      const overtimePay = overtimeHours * emp.hourly_rate * 1.5
      const grossPay = regularPay + overtimePay
      const alreadyApproved = payrollRecords.some(
        r => r.employee_id === emp.id &&
             r.payroll_period_start === weekStart &&
             r.payroll_period_end === weekEnd
      )
      return { employee: emp, regularHours, overtimeHours, regularPay, overtimePay, grossPay, alreadyApproved }
    })
    .filter(Boolean) as EmpWeekRow[]

  const handleApprove = async (row: EmpWeekRow) => {
    setSaving(true)
    const method = paymentMethods[row.employee.id] || 'Check'
    const grossPay = row.grossPay

    const { error } = await supabase.from('payroll').insert([{
      payroll_period_start: weekStart,
      payroll_period_end: weekEnd,
      employee_id: row.employee.id,
      regular_hours: row.regularHours,
      overtime_hours: row.overtimeHours,
      gross_pay: grossPay,
      taxes: 0,
      benefits: 0,
      reimbursements: 0,
      total_employer_cost: grossPay,
      status: 'approved',
      payment_method: method,
    }])

    if (error) {
      console.error('Payroll insert error:', error)
      alert('Error saving payroll: ' + error.message)
    } else {
      await loadData()
    }
    setSaving(false)
  }

  const handleApproveAll = async () => {
    const pending = weekRows.filter(r => !r.alreadyApproved)
    if (pending.length === 0) return
    setSaving(true)
    for (const row of pending) {
      const method = paymentMethods[row.employee.id] || 'Check'
      await supabase.from('payroll').insert([{
        payroll_period_start: weekStart,
        payroll_period_end: weekEnd,
        employee_id: row.employee.id,
        regular_hours: row.regularHours,
        overtime_hours: row.overtimeHours,
        gross_pay: row.grossPay,
        taxes: 0,
        benefits: 0,
        reimbursements: 0,
        total_employer_cost: row.grossPay,
        status: 'approved',
        payment_method: method,
      }])
    }
    await loadData()
    setSaving(false)
  }

  const handleMarkPaid = async (id: string) => {
    await supabase.from('payroll').update({ status: 'paid' }).eq('id', id)
    setPayrollRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' } : r))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payroll record?')) return
    await supabase.from('payroll').delete().eq('id', id)
    setPayrollRecords(prev => prev.filter(r => r.id !== id))
  }

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Unknown'

  const filteredRecords = payrollRecords.filter(r => statusFilter === 'all' || r.status === statusFilter)

  const statusColors: Record<string, string> = {
    pending:  'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    paid:     'bg-green-100 text-green-800',
  }

  const totalGross = filteredRecords.reduce((s, r) => s + (r.gross_pay || 0), 0)
  const totalApproved = payrollRecords.filter(r => r.status === 'approved').reduce((s, r) => s + (r.gross_pay || 0), 0)
  const totalPaid = payrollRecords.filter(r => r.status === 'paid').reduce((s, r) => s + (r.gross_pay || 0), 0)

  if (loading) return <div className="text-center py-20" style={{ color: 'var(--color-muted)' }}>Loading...</div>

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Payroll</h1>
        <p style={{ color: 'var(--color-muted)' }}>Weekly payroll from labor hours</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Payroll', value: fmtCurrency(totalGross), icon: DollarSign },
          { label: 'Awaiting Payment', value: fmtCurrency(totalApproved), icon: Clock },
          { label: 'Total Paid Out', value: fmtCurrency(totalPaid), icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-lg p-5 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 opacity-40" style={{ color: 'var(--color-gold)' }} />
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{label}</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Week Pay Period ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-linen)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>Process Payroll</h2>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Based on approved labor hours</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>Week starting</label>
            <input
              type="date"
              value={weekStart}
              onChange={e => setWeekStart(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
            />
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>→ {fmtDate(weekEnd)}</span>
          </div>
        </div>

        {weekRows.length === 0 ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--color-muted)' }}>
            No labor hours recorded for this week.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Employee</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Reg Hrs</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>OT Hrs</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Reg Pay</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>OT Pay</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Gross Pay</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Payment Method</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {weekRows.map(row => (
                    <tr key={row.employee.id} className="border-t hover:bg-gray-50 transition" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                        {row.employee.name}
                        <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-muted)' }}>
                          ${row.employee.hourly_rate}/hr
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center" style={{ color: 'var(--color-navy)' }}>
                        {row.regularHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center" style={{ color: row.overtimeHours > 0 ? '#d97706' : 'var(--color-muted)' }}>
                        {row.overtimeHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right" style={{ color: 'var(--color-navy)' }}>
                        {fmtCurrency(row.regularPay)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right" style={{ color: row.overtimePay > 0 ? '#d97706' : 'var(--color-muted)' }}>
                        {fmtCurrency(row.overtimePay)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold" style={{ color: 'var(--color-navy)' }}>
                        {fmtCurrency(row.grossPay)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        {row.alreadyApproved ? (
                          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>—</span>
                        ) : (
                          <select
                            value={paymentMethods[row.employee.id] || 'Check'}
                            onChange={e => setPaymentMethods(prev => ({ ...prev, [row.employee.id]: e.target.value }))}
                            className="px-2 py-1 rounded border text-xs focus:outline-none"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                          >
                            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.alreadyApproved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Approved
                          </span>
                        ) : (
                          <button
                            onClick={() => handleApprove(row)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                            style={{ backgroundColor: 'var(--color-navy)' }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {weekRows.some(r => !r.alreadyApproved) && (
                  <tfoot style={{ borderTop: `2px solid var(--color-border)` }}>
                    <tr>
                      <td colSpan={5} className="px-6 py-3 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                        Week Total
                      </td>
                      <td className="px-6 py-3 text-sm font-bold text-right" style={{ color: 'var(--color-navy)' }}>
                        {fmtCurrency(weekRows.filter(r => !r.alreadyApproved).reduce((s, r) => s + r.grossPay, 0))}
                      </td>
                      <td />
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={handleApproveAll}
                          disabled={saving}
                          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          Approve All
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Payroll History ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-linen)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>Payroll History</h2>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--color-muted)' }}>
            No payroll records yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Pay Period</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Hours</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Gross Pay</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Payment</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(record => (
                  <tr key={record.id} className="border-t hover:bg-gray-50 transition" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                      {getEmployeeName(record.employee_id)}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>
                      {fmtDate(record.payroll_period_start)} – {fmtDate(record.payroll_period_end)}
                    </td>
                    <td className="px-6 py-4 text-sm text-center" style={{ color: 'var(--color-navy)' }}>
                      {((record.regular_hours || 0) + (record.overtime_hours || 0)).toFixed(1)}h
                      {(record.overtime_hours || 0) > 0 && (
                        <span className="ml-1 text-xs" style={{ color: '#d97706' }}>
                          ({record.overtime_hours}h OT)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                      {fmtCurrency(record.gross_pay)}
                    </td>
                    <td className="px-6 py-4 text-sm text-center" style={{ color: 'var(--color-muted)' }}>
                      {record.payment_method || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[record.status] || 'bg-gray-100 text-gray-800'}`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        {record.status === 'approved' && (
                          <button
                            onClick={() => handleMarkPaid(record.id)}
                            className="text-xs font-semibold text-white px-3 py-1 rounded-lg hover:opacity-90 transition"
                            style={{ backgroundColor: '#16a34a' }}
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="text-xs text-red-500 hover:text-red-700 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SQL migration note */}
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Note: if payment method doesn&apos;t save, run in Supabase SQL editor:{' '}
        <code className="bg-gray-100 px-1 rounded">ALTER TABLE payroll ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT &apos;check&apos;;</code>
      </p>
    </div>
  )
}
