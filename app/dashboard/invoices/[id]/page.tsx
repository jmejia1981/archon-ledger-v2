'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Breadcrumbs } from '@/app/components/breadcrumbs'
import { downloadInvoicePDF } from '@/lib/pdf-invoice'
import { generateInvoicePDFBlob } from '@/lib/pdf-invoice'
import { Edit, Save, X, DollarSign, Mail, Download, Plus, Trash2 } from 'lucide-react'

interface LineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

const supabase = createClient()

export default function InvoiceDetailPage() {
  const params = useParams()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<any>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [client, setClient] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [emailingInvoice, setEmailingInvoice] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  const [formData, setFormData] = useState<any>({})
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([])

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'check',
    notes: '',
  })

  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [invoiceRes, clientsRes, projectsRes] = await Promise.all([
          supabase.from('invoices').select('*').eq('id', invoiceId).single(),
          supabase.from('clients').select('id, name, email, phone'),
          supabase.from('projects').select('id, project_name, project_address, external_project_manager'),
        ])

        if (invoiceRes.error) throw invoiceRes.error
        const inv = invoiceRes.data
        setInvoice(inv)
        setFormData({
          invoice_number: inv.invoice_number,
          client_id: inv.client_id,
          project_id: inv.project_id || '',
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          invoice_amount: inv.invoice_amount,
          tax: inv.tax || '',
          retainage: inv.retainage || '',
          notes: inv.notes || '',
          status: inv.status,
          payment_terms: inv.payment_terms || 'Net 30',
        })

        setClients(clientsRes.data || [])
        setProjects(projectsRes.data || [])

        // Resolve client and project for display
        const foundClient = (clientsRes.data || []).find((c: any) => c.id === inv.client_id)
        const foundProject = (projectsRes.data || []).find((p: any) => p.id === inv.project_id)
        setClient(foundClient || null)
        setProject(foundProject || null)

        // Load line items
        const { data: itemsData } = await supabase
          .from('line_items')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: true })

        const items = itemsData || []
        setLineItems(items)
        setEditLineItems(items.map((i: any) => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity || 1,
          unit_price: i.unit_price || i.amount,
          amount: i.amount,
        })))
      } catch (error) {
        console.error('Error loading invoice:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [invoiceId])

  // Recalculate invoice_amount from line items in edit mode
  useEffect(() => {
    if (!editing) return
    const subtotal = editLineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    setFormData((prev: any) => ({ ...prev, invoice_amount: subtotal }))
  }, [editLineItems, editing])

  const handleSaveChanges = async () => {
    if (!invoice) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          invoice_number: formData.invoice_number,
          client_id: formData.client_id,
          project_id: formData.project_id || null,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          invoice_amount: parseFloat(formData.invoice_amount),
          tax: formData.tax ? parseFloat(formData.tax) : null,
          retainage: formData.retainage ? parseFloat(formData.retainage) : null,
          notes: formData.notes || null,
          status: formData.status,
          payment_terms: formData.payment_terms,
        })
        .eq('id', invoiceId)

      if (error) throw error

      // Upsert line items
      const toDelete = lineItems.filter(li => li.id && !editLineItems.find(eli => eli.id === li.id))
      for (const del of toDelete) {
        await supabase.from('line_items').delete().eq('id', del.id!)
      }

      for (const item of editLineItems) {
        if (item.id) {
          await supabase.from('line_items').update({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          }).eq('id', item.id)
        } else {
          await supabase.from('line_items').insert({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          })
        }
      }

      const updatedInvoice = { ...invoice, ...formData, invoice_amount: parseFloat(formData.invoice_amount) }
      setInvoice(updatedInvoice)
      setLineItems(editLineItems.map(i => ({ ...i })))

      const foundClient = clients.find((c: any) => c.id === formData.client_id)
      const foundProject = projects.find((p: any) => p.id === formData.project_id)
      setClient(foundClient || null)
      setProject(foundProject || null)

      setEditing(false)
      alert('Invoice updated successfully!')
    } catch (error) {
      console.error('Error updating invoice:', error)
      alert('Failed to update invoice')
    } finally {
      setSaving(false)
    }
  }

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentData.amount)
    if (!invoice || !amount || amount <= 0) {
      alert('Please enter a valid payment amount greater than 0')
      return
    }

    const newAmountPaid = (invoice.amount_paid || 0) + amount
    const newStatus = newAmountPaid >= (invoice.invoice_amount || 0) ? 'paid' : 'partial'

    const { error } = await supabase
      .from('invoices')
      .update({ amount_paid: newAmountPaid, status: newStatus })
      .eq('id', invoiceId)

    if (error) {
      console.error('Record payment error:', error)
      alert('Failed to record payment: ' + (error.message || JSON.stringify(error)))
      return
    }

    setInvoice({ ...invoice, amount_paid: newAmountPaid, status: newStatus })
    setPaymentData({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'check', notes: '' })
    setRecordingPayment(false)
    alert('Payment recorded successfully!')
  }

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true)
    try {
      let logoImage: string | undefined
      try {
        const response = await fetch('/images/archon-header.png')
        const blob = await response.blob()
        const reader = new FileReader()
        logoImage = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch {}

      const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0)
      const total = subtotal + (invoice.tax || 0)

      downloadInvoicePDF(
        {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          clientName: client?.name || '',
          clientEmail: client?.email,
          clientPhone: client?.phone,
          projectName: project?.project_name,
          projectAddress: project?.project_address,
          logoImage,
          lineItems: lineItems.map(i => ({
            description: i.description,
            quantity: i.quantity || 1,
            unitPrice: i.unit_price || i.amount,
            amount: i.amount,
          })),
          subtotal,
          tax: invoice.tax,
          retainage: invoice.retainage,
          amountPaid: invoice.amount_paid,
          remainingBalance: total - (invoice.amount_paid || 0),
          notes: invoice.notes,
          paymentTerms: invoice.payment_terms,
        },
        `${invoice.invoice_number}.pdf`
      )
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to download PDF')
    } finally {
      setDownloadingPDF(false)
    }
  }

  const handleEmailInvoice = async () => {
    setEmailingInvoice(true)
    try {
      // Generate and download the PDF
      const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0)
      const total = subtotal + (invoice.tax || 0)

      let logoImage: string | undefined
      try {
        const response = await fetch('/images/archon-header.png')
        const blob = await response.blob()
        const reader = new FileReader()
        logoImage = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch {}

      const pdfBlob = await generateInvoicePDFBlob({
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        clientName: client?.name || '',
        clientEmail: client?.email,
        clientPhone: client?.phone,
        projectName: project?.project_name,
        projectAddress: project?.project_address,
        logoImage,
        lineItems: lineItems.map(i => ({
          description: i.description,
          quantity: i.quantity || 1,
          unitPrice: i.unit_price || i.amount,
          amount: i.amount,
        })),
        subtotal,
        tax: invoice.tax,
        retainage: invoice.retainage,
        amountPaid: invoice.amount_paid,
        remainingBalance: total - (invoice.amount_paid || 0),
        notes: invoice.notes,
        paymentTerms: invoice.payment_terms,
      })

      // Trigger PDF download
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      // Open default mail app
      const subject = encodeURIComponent(`Invoice ${invoice.invoice_number} from Archon Construction`)
      const outstanding = invoice.invoice_amount - (invoice.amount_paid || 0)
      const body = encodeURIComponent(
        `Hi ${client?.name || ''},\n\nPlease find attached invoice ${invoice.invoice_number} for ${formatCurrency(outstanding)}, due ${formatDate(invoice.due_date)}.\n\nThank you,\nArchon Construction`
      )
      const to = client?.email ? encodeURIComponent(client.email) : ''
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`

      // Mark as sent if still draft
      if (invoice.status === 'draft') {
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId)
        setInvoice({ ...invoice, status: 'sent' })
      }
    } catch (error) {
      console.error('Error emailing invoice:', error)
      alert('Failed to generate PDF')
    } finally {
      setEmailingInvoice(false)
    }
  }

  const updateEditLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...editLineItems]
    updated[index] = { ...updated[index], [field]: value }
    // Auto-calculate amount from qty * unit_price
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].amount = Number(updated[index].quantity) * Number(updated[index].unit_price)
    }
    setEditLineItems(updated)
  }

  const addLineItem = () => {
    setEditLineItems([...editLineItems, { description: '', quantity: 1, unit_price: 0, amount: 0 }])
  }

  const removeLineItem = (index: number) => {
    setEditLineItems(editLineItems.filter((_, i) => i !== index))
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)

  const outstanding = (invoice?.invoice_amount || 0) - (invoice?.amount_paid || 0)

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-800',
    partial: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
  }

  if (loading) return <div className="text-center py-12">Loading invoice...</div>
  if (!invoice) return <div className="text-center py-12 text-red-600">Invoice not found</div>

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          { label: invoice.invoice_number },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--color-navy)' }}>
            {invoice.invoice_number}
          </h1>
          <p style={{ color: 'var(--color-muted)' }}>
            {client?.name || '—'} {project ? `· ${project.project_name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:opacity-80 transition disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <Download className="w-4 h-4" />
            {downloadingPDF ? 'Generating...' : 'Download'}
          </button>
          <button
            onClick={handleEmailInvoice}
            disabled={emailingInvoice}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:opacity-80 transition disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <Mail className="w-4 h-4" />
            {emailingInvoice ? 'Preparing...' : 'Email'}
          </button>
          {!editing && invoice.status !== 'paid' && (
            <button
              onClick={() => setRecordingPayment(!recordingPayment)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-navy)' }}
            >
              <DollarSign className="w-4 h-4" />
              Record Payment
            </button>
          )}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-gold, #C8B89A)' }}
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:opacity-80 transition"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status / Totals */}
      <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Status</p>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${statusColors[invoice.status] || 'bg-gray-100 text-gray-700'}`}>
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
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Paid</p>
            <p className="font-semibold text-lg" style={{ color: 'var(--color-success, #16a34a)' }}>
              {formatCurrency(invoice.amount_paid || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Outstanding</p>
            <p className="font-semibold text-lg" style={{ color: outstanding > 0 ? 'var(--color-destructive, #dc2626)' : 'var(--color-success, #16a34a)' }}>
              {formatCurrency(outstanding)}
            </p>
          </div>
        </div>
      </div>

      {/* View / Edit Form */}
      {!editing ? (
        <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>Invoice Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
            <div>
              <p style={{ color: 'var(--color-muted)' }}>Invoice Date</p>
              <p className="font-medium mt-1">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--color-muted)' }}>Due Date</p>
              <p className="font-medium mt-1">{formatDate(invoice.due_date)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--color-muted)' }}>Payment Terms</p>
              <p className="font-medium mt-1">{invoice.payment_terms || '—'}</p>
            </div>
            {project?.external_project_manager && (
              <div>
                <p style={{ color: 'var(--color-muted)' }}>External Project Manager</p>
                <p className="font-medium mt-1">{project.external_project_manager}</p>
              </div>
            )}
            {invoice.tax > 0 && (
              <div>
                <p style={{ color: 'var(--color-muted)' }}>Tax</p>
                <p className="font-medium mt-1">{formatCurrency(invoice.tax)}</p>
              </div>
            )}
            {invoice.retainage > 0 && (
              <div>
                <p style={{ color: 'var(--color-muted)' }}>Retainage</p>
                <p className="font-medium mt-1">{formatCurrency(invoice.retainage)}</p>
              </div>
            )}
            {invoice.notes && (
              <div className="col-span-2 md:col-span-3">
                <p style={{ color: 'var(--color-muted)' }}>Notes</p>
                <p className="font-medium mt-1 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-6 space-y-6" style={{ border: `1px solid var(--color-border)` }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>Edit Invoice</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Invoice Number</label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="approved">Approved</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Client</label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="">— Select client —</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Project</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="">— Select project —</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Invoice Date</label>
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Payment Terms</label>
              <input
                type="text"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                placeholder="Net 30"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Line Items</h3>
              <button
                onClick={addLineItem}
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg border hover:opacity-80 transition"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {editLineItems.map((item, idx) => (
                <div key={idx} className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateEditLineItem(idx, 'description', e.target.value)}
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateEditLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-16 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <input
                    type="number"
                    placeholder="Unit Price"
                    value={item.unit_price}
                    onChange={(e) => updateEditLineItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <div className="w-24 px-3 py-2 text-sm font-medium text-right" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(item.amount)}
                  </div>
                  <button
                    onClick={() => removeLineItem(idx)}
                    className="p-2 hover:opacity-70 transition flex-shrink-0"
                    style={{ color: 'var(--color-destructive, #dc2626)' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Subtotal</label>
              <input
                type="number"
                value={formData.invoice_amount}
                readOnly
                className="w-full px-3 py-2 rounded-lg border text-sm bg-gray-50"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Tax</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.tax}
                onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Retainage</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.retainage}
                onChange={(e) => setFormData({ ...formData, retainage: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Payment instructions, special terms..."
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
        </div>
      )}

      {/* Line Items (view mode) */}
      {!editing && (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: `1px solid var(--color-border)` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid var(--color-border)` }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>Line Items</h2>
          </div>
          {lineItems.length > 0 ? (
            <>
              <table className="w-full">
                <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Description</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Unit Price</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: `1px solid var(--color-border)` }}>
                      <td className="px-6 py-3 text-sm">{item.description}</td>
                      <td className="px-6 py-3 text-sm text-center">{item.quantity}</td>
                      <td className="px-6 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-6 py-3 text-sm text-right font-semibold">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-6 py-4 space-y-1 text-sm" style={{ borderTop: `1px solid var(--color-border)` }}>
                <div className="flex justify-end gap-8">
                  <span style={{ color: 'var(--color-muted)' }}>Subtotal</span>
                  <span className="font-medium w-28 text-right">{formatCurrency(invoice.invoice_amount)}</span>
                </div>
                {invoice.tax > 0 && (
                  <div className="flex justify-end gap-8">
                    <span style={{ color: 'var(--color-muted)' }}>Tax</span>
                    <span className="font-medium w-28 text-right">{formatCurrency(invoice.tax)}</span>
                  </div>
                )}
                {invoice.retainage > 0 && (
                  <div className="flex justify-end gap-8">
                    <span style={{ color: 'var(--color-muted)' }}>Retainage</span>
                    <span className="font-medium w-28 text-right">-{formatCurrency(invoice.retainage)}</span>
                  </div>
                )}
                <div className="flex justify-end gap-8 pt-2 font-bold text-base" style={{ borderTop: `1px solid var(--color-border)`, color: 'var(--color-navy)' }}>
                  <span>Total</span>
                  <span className="w-28 text-right">{formatCurrency(invoice.invoice_amount + (invoice.tax || 0))}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="px-6 py-8 text-sm" style={{ color: 'var(--color-muted)' }}>No line items on this invoice.</p>
          )}
        </div>
      )}

      {/* Record Payment Panel */}
      {recordingPayment && (
        <div className="bg-white rounded-lg p-6 space-y-4" style={{ border: `1px solid var(--color-border)` }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>Record Payment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Amount</label>
              <input
                type="number"
                step="0.01"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                placeholder={formatCurrency(outstanding)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Payment Date</label>
              <input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Method</label>
              <select
                value={paymentData.payment_method}
                onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: 'var(--color-border)' }}
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
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Notes (optional)</label>
            <input
              type="text"
              value={paymentData.notes}
              onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              placeholder="Check #, reference number..."
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setRecordingPayment(false)}
              className="flex-1 px-4 py-2 rounded-lg border hover:opacity-80 transition text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleRecordPayment}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm font-medium"
              style={{ backgroundColor: 'var(--color-navy)' }}
            >
              Record Payment
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
