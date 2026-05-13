'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus,
  Search,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'
import { SkeletonTable } from '@/app/components/skeleton-loader'

interface Payment {
  id: string
  invoice_id: string
  invoice_number: string
  client_name: string
  amount: number
  payment_date: string
  payment_method: string
  status: 'pending' | 'completed' | 'failed'
  notes: string | null
  created_at: string
}

interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  clients: { name: string; email: string }[]
  invoice_amount: number
  amount_paid: number
  status: string
}

interface PaymentFormData {
  invoice_id: string
  amount: string
  payment_date: string
  payment_method: string
  notes: string
}

const initialFormData: PaymentFormData = {
  invoice_id: '',
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: 'check',
  notes: '',
}

export default function PaymentsPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<PaymentFormData>(initialFormData)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          invoice_id,
          amount,
          payment_date,
          payment_method,
          status,
          notes,
          created_at,
          invoices(invoice_number, clients(name))
        `)
        .order('payment_date', { ascending: false })

      if (paymentsError) throw paymentsError

      // Format payments data
      const formattedPayments = (paymentsData || []).map((p: any) => ({
        id: p.id,
        invoice_id: p.invoice_id,
        invoice_number: p.invoices?.invoice_number || 'Unknown',
        client_name: p.invoices?.clients?.name || 'Unknown',
        amount: p.amount,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        status: p.status,
        notes: p.notes,
        created_at: p.created_at,
      }))

      setPayments(formattedPayments)

      // Fetch open invoices for form dropdown
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          client_id,
          clients(name, email),
          invoice_amount,
          amount_paid,
          status
        `)
        .neq('status', 'paid')
        .order('created_at', { ascending: false })

      if (invoicesError) throw invoicesError
      setInvoices(invoicesData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.payment_method.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleOpenForm = () => {
    setFormData(initialFormData)
    setFormError('')
    setFormSuccess('')
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setFormData(initialFormData)
    setFormError('')
    setFormSuccess('')
  }

  const validateForm = (): boolean => {
    if (!formData.invoice_id) {
      setFormError('Please select an invoice')
      return false
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setFormError('Payment amount must be greater than 0')
      return false
    }
    if (!formData.payment_date) {
      setFormError('Payment date is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setFormLoading(true)
    try {
      const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
      if (!selectedInvoice) throw new Error('Invoice not found')

      const paymentAmount = parseFloat(formData.amount)
      const newAmountPaid = selectedInvoice.amount_paid + paymentAmount
      const totalAmount = selectedInvoice.invoice_amount + (selectedInvoice.status === 'paid' ? 0 : 0)
      const newStatus = newAmountPaid >= totalAmount ? 'paid' : 'pending'

      // Insert payment record
      const { error: insertError } = await supabase
        .from('payments')
        .insert([
          {
            invoice_id: formData.invoice_id,
            amount: paymentAmount,
            payment_date: formData.payment_date,
            payment_method: formData.payment_method,
            status: 'completed',
            notes: formData.notes || null,
            created_at: new Date().toISOString(),
          },
        ])

      if (insertError) throw insertError

      // Update invoice with new payment amount and status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', formData.invoice_id)

      if (updateError) throw updateError

      setFormSuccess('Payment recorded successfully!')
      await fetchData()
      setTimeout(() => handleCloseForm(), 1500)
    } catch (error) {
      console.error('Error recording payment:', error)
      setFormError('Failed to record payment. Please try again.')
    } finally {
      setFormLoading(false)
    }
  }

  const calculateOutstanding = (invoice: Invoice) => {
    return Math.max(0, invoice.invoice_amount - invoice.amount_paid)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
  const completedPayments = payments.filter(p => p.status === 'completed').length
  const pendingPayments = payments.filter(p => p.status === 'pending').length

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payments' },
        ]}
      />

      <div className="mt-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>
              Payment Tracking
            </h1>
            <p className="text-gray-600 mt-1">
              Record and monitor all client payments
            </p>
          </div>

          <button
            onClick={handleOpenForm}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--color-navy)' }}
          >
            <Plus className="w-5 h-5" />
            Record Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm text-gray-600 mb-2">Total Payments</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
            {formatCurrency(totalPayments)}
          </p>
          <p className="text-xs text-gray-500 mt-2">{payments.length} transactions</p>
        </div>

        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm text-gray-600 mb-2">Completed</p>
          <p className="text-2xl font-bold text-green-600">
            {completedPayments}
          </p>
          <p className="text-xs text-gray-500 mt-2">Successful payments</p>
        </div>

        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm text-gray-600 mb-2">Pending</p>
          <p className="text-2xl font-bold text-orange-600">
            {pendingPayments}
          </p>
          <p className="text-xs text-gray-500 mt-2">Awaiting confirmation</p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search
              className="absolute left-3 top-3 w-5 h-5"
              style={{ color: 'var(--color-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by invoice, client, or method..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--color-border)',
              }}
            />
          </div>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-navy)',
          }}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && <SkeletonTable rows={5} />}

      {/* Payments Table */}
      {!loading && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Client
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Method
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No payments match your filters'
                      : 'No payments recorded yet. Record one to get started.'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-t hover:bg-gray-50 transition" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                      {payment.invoice_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {payment.client_name}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                      {payment.payment_method}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor:
                            payment.status === 'completed'
                              ? '#e8f5e9'
                              : payment.status === 'pending'
                              ? '#fff3e0'
                              : '#ffebee',
                          color:
                            payment.status === 'completed'
                              ? '#2e7d32'
                              : payment.status === 'pending'
                              ? '#f57c00'
                              : '#d32f2f',
                        }}
                      >
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div
              className="flex items-center justify-between p-6 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-navy)' }}>
                Record Payment
              </h2>
              <button onClick={handleCloseForm} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Error Message */}
              {formError && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

              {/* Success Message */}
              {formSuccess && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700">{formSuccess}</p>
                </div>
              )}

              {/* Invoice Selection */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                  Select Invoice *
                </label>
                <select
                  value={formData.invoice_id}
                  onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <option value="">Choose an invoice...</option>
                  {invoices.map((invoice) => {
                    const outstanding = calculateOutstanding(invoice)
                    return (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.clients[0]?.name} - Outstanding: {formatCurrency(outstanding)}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Invoice Details */}
              {formData.invoice_id && invoices.find(inv => inv.id === formData.invoice_id) && (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--color-linen)' }}
                >
                  {(() => {
                    const invoice = invoices.find(inv => inv.id === formData.invoice_id)
                    if (!invoice) return null

                    const outstanding = calculateOutstanding(invoice)
                    return (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice Amount:</span>
                          <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                            {formatCurrency(invoice.invoice_amount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Already Paid:</span>
                          <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                            {formatCurrency(invoice.amount_paid)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                          <span className="font-semibold text-gray-600">Outstanding Balance:</span>
                          <span className="font-bold text-lg" style={{ color: 'var(--color-navy)' }}>
                            {formatCurrency(outstanding)}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Payment Details */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Payment Details
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Payment Amount *
                    </label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Payment Method
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <option value="check">Check</option>
                      <option value="ach">ACH Transfer</option>
                      <option value="wire">Wire Transfer</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Add any notes about this payment..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="flex-1 px-4 py-2 rounded-lg border font-medium transition hover:bg-gray-50"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--color-navy)' }}
                >
                  {formLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Record Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
