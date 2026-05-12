'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Breadcrumbs } from '@/app/components/breadcrumbs'
import { Edit, Save, Check, DollarSign } from 'lucide-react'

export default function InvoiceDetailPage() {
  const params = useParams()
  const invoiceId = params.id as string
  const supabase = createClient()

  const [invoice, setInvoice] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)

  const [formData, setFormData] = useState<any>({
    invoice_number: '',
    client_id: '',
    invoice_date: '',
    due_date: '',
    invoice_amount: '',
    status: 'draft',
    payment_terms: 'Net 30',
  })

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'check',
  })

  const [clients, setClients] = useState<any[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load invoice
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single()

        if (invoiceError) throw invoiceError

        setInvoice(invoiceData)
        setFormData({
          invoice_number: invoiceData.invoice_number,
          client_id: invoiceData.client_id,
          invoice_date: invoiceData.invoice_date,
          due_date: invoiceData.due_date,
          invoice_amount: invoiceData.invoice_amount,
          status: invoiceData.status,
          payment_terms: invoiceData.payment_terms,
        })

        // Load line items
        const { data: itemsData } = await supabase
          .from('line_items')
          .select('*')
          .eq('invoice_id', invoiceId)

        setLineItems(itemsData || [])

        // Load clients for dropdown
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')

        setClients(clientsData || [])
      } catch (error) {
        console.error('Error loading invoice:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [invoiceId, supabase])

  const handleSaveChanges = async () => {
    if (!invoice) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          invoice_number: formData.invoice_number,
          client_id: formData.client_id,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          invoice_amount: parseFloat(formData.invoice_amount),
          status: formData.status,
          payment_terms: formData.payment_terms,
        })
        .eq('id', invoiceId)

      if (error) throw error

      setInvoice({ ...invoice, ...formData })
      setEditing(false)
      alert('Invoice updated successfully!')
    } catch (error) {
      console.error('Error updating invoice:', error)
      alert('Failed to update invoice')
    } finally {
      setSaving(false)
    }
  }

  const handleApproveInvoice = async () => {
    if (!invoice) return

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'approved' })
        .eq('id', invoiceId)

      if (error) throw error

      setInvoice({ ...invoice, status: 'approved' })
      alert('Invoice approved!')
    } catch (error) {
      console.error('Error approving invoice:', error)
      alert('Failed to approve invoice')
    }
  }

  const handleRecordPayment = async () => {
    if (!invoice || !paymentData.amount) {
      alert('Please enter a payment amount')
      return
    }

    try {
      const newAmountPaid = (invoice.amount_paid || 0) + parseFloat(paymentData.amount)

      const { error } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newAmountPaid >= invoice.invoice_amount ? 'paid' : 'partial',
        })
        .eq('id', invoiceId)

      if (error) throw error

      setInvoice({
        ...invoice,
        amount_paid: newAmountPaid,
        status: newAmountPaid >= invoice.invoice_amount ? 'paid' : 'partial',
      })

      setPaymentData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'check',
      })
      setRecordingPayment(false)
      alert('Payment recorded successfully!')
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const outstanding = (invoice?.invoice_amount || 0) - (invoice?.amount_paid || 0)
  const statusColors: Record<string, string> = {
    draft: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
  }

  if (loading) {
    return <div className="text-center py-12">Loading invoice...</div>
  }

  if (!invoice) {
    return <div className="text-center py-12 text-red-600">Invoice not found</div>
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          { label: invoice.invoice_number },
        ]}
      />

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--color-navy)' }}>
            {invoice.invoice_number}
          </h1>
          <p style={{ color: 'var(--color-muted)' }}>
            {formatDate(invoice.invoice_date)} • {formatDate(invoice.due_date)}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:opacity-80 transition"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              {invoice.status === 'draft' && (
                <button
                  onClick={handleApproveInvoice}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                  style={{ backgroundColor: 'var(--color-success)' }}
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
              )}
              {invoice.status !== 'paid' && (
                <button
                  onClick={() => setRecordingPayment(!recordingPayment)}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                  style={{ backgroundColor: 'var(--color-navy)' }}
                >
                  <DollarSign className="w-4 h-4" />
                  Record Payment
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invoice Status */}
      <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Status</p>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block mt-1 ${statusColors[invoice.status]}`}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Invoice Total</p>
            <p className="font-semibold text-lg" style={{ color: 'var(--color-navy)' }}>
              {formatCurrency(invoice.invoice_amount)}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Outstanding</p>
            <p className="font-semibold text-lg" style={{ color: outstanding > 0 ? 'var(--color-destructive)' : 'var(--color-success)' }}>
              {formatCurrency(outstanding)}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
            Edit Invoice
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Client
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  placeholder="e.g., Net 30"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                Invoice Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.invoice_amount}
                onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 px-4 py-2 rounded-lg hover:opacity-80 transition"
                style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white', color: 'var(--color-navy)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-lg p-6 overflow-hidden" style={{ border: `1px solid var(--color-border)` }}>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
          Items
        </h2>
        {lineItems.length > 0 ? (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)' }}>
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Description
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid var(--color-border)` }}>
                  <td className="px-4 py-3 text-sm">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--color-muted)' }}>No line items</p>
        )}
      </div>

      {/* Record Payment */}
      {recordingPayment && (
        <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
            Record Payment
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Payment Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)' }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Payment Method
                </label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="ach">ACH</option>
                  <option value="wire">Wire Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRecordingPayment(false)}
                className="flex-1 px-4 py-2 rounded-lg hover:opacity-80 transition"
                style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white', color: 'var(--color-navy)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                style={{ backgroundColor: 'var(--color-success)' }}
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
                                                                                                                                                                                                              