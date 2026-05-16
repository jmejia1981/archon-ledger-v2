'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Trash2, Eye, Download, FileDown } from 'lucide-react'
import { SkeletonTable } from '@/app/components/skeleton-loader'
import { downloadInvoicePDF } from '@/lib/pdf-invoice'

interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  project_id: string
  invoice_date: string
  due_date: string
  invoice_amount: number
  amount_paid: number
  tax?: number
  retainage?: number
  notes?: string
  status: string
  payment_terms: string
}

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
}

interface Project {
  id: string
  project_name: string
}

const supabase = createClient()

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false)
  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    project_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    invoice_amount: '',
    tax: '',
    retainage: '',
    payment_terms: 'Net 30',
    status: 'draft',
    is_recurring: false,
    recurring_frequency: 'monthly',
  })
  const [lineItems, setLineItems] = useState([
    { description: '', amount: '' }
  ])

  // Auto-calculate invoice amount from line items
  useEffect(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0
      return sum + amount
    }, 0)

    setFormData(prev => ({
      ...prev,
      invoice_amount: subtotal.toString(),
    }))
  }, [lineItems])

  // Load invoices, clients, and projects
  useEffect(() => {
    const loadData = async () => {
      try {
        const [invoicesData, clientsData, projectsData] = await Promise.all([
          supabase.from('invoices').select('*'),
          supabase.from('clients').select('id, name'),
          supabase.from('projects').select('id, project_name'),
        ])

        setInvoices(invoicesData.data || [])
        setClients(clientsData.data || [])
        setProjects(projectsData.data || [])
      } catch (error) {
        console.log('Error loading data - tables may not exist yet')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter and search invoices
  useEffect(() => {
    let filtered = invoices

    if (statusFilter !== 'all') {
      filtered = filtered.filter((inv) => inv.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.client_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredInvoices(filtered)
  }, [invoices, statusFilter, searchTerm])

  // Generate next invoice number
  const generateNextInvoiceNumber = () => {
    const numbers = invoices
      .map((inv) => {
        const match = inv.invoice_number.match(/INV-(\d+)/)
        return match ? parseInt(match[1]) : 0
      })
      .sort((a, b) => b - a)

    const nextNumber = Math.max(numbers[0] || 0, 2) + 1
    return `INV-${nextNumber.toString().padStart(3, '0')}`
  }

  // Handle open new invoice form
  const handleOpenNewInvoiceForm = () => {
    const nextNumber = generateNextInvoiceNumber()
    setFormData({
      invoice_number: nextNumber,
      client_id: '',
      project_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      invoice_amount: '',
      tax: '',
      retainage: '',
      payment_terms: 'Net 30',
      status: 'draft',
      is_recurring: false,
      recurring_frequency: 'monthly',
    })
    setLineItems([{ description: '', amount: '' }])
    setShowNewInvoiceForm(true)
  }

  // Handle create invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client_id) {
      alert('Client is required')
      return
    }

    try {
      console.log('Creating invoice:', formData)

      // Calculate invoice amount from line items if provided
      let invoiceAmount = parseFloat(formData.invoice_amount) || 0
      if (lineItems.some(item => item.description)) {
        invoiceAmount = lineItems.reduce((total, item) => {
          const amount = parseFloat(item.amount.toString()) || 0
          return total + amount
        }, 0)
      }

      const tax = parseFloat(formData.tax) || 0

      const { data, error } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: formData.invoice_number,
            client_id: formData.client_id,
            project_id: formData.project_id || null,
            invoice_date: formData.invoice_date,
            due_date: formData.due_date,
            invoice_amount: invoiceAmount,
            tax: tax,
            retainage: parseFloat(formData.retainage) || 0,
            amount_paid: 0,
            payment_terms: formData.payment_terms,
            status: formData.status,
            is_recurring: formData.is_recurring,
            recurring_frequency: formData.is_recurring ? formData.recurring_frequency : null,
          },
        ])
        .select()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to create: ${error.message}`)
      }

      console.log('Invoice created successfully:', data)
      if (data) {
        // Add line items if provided
        if (lineItems.some(item => item.description) && data[0]) {
          const itemsToInsert = lineItems
            .filter(item => item.description)
            .map(item => ({
              invoice_id: data[0].id,
              description: item.description,
              quantity: 1,
              unit_price: parseFloat(item.amount.toString()) || 0,
              amount: parseFloat(item.amount.toString()) || 0,
            }))

          try {
            const { data: insertedItems, error: insertError } = await supabase
              .from('line_items')
              .insert(itemsToInsert)
              .select()

            if (insertError) {
              console.error('Line items insert error:', insertError)
            } else {
              console.log('Line items inserted successfully:', insertedItems)
            }
          } catch (e) {
            console.error('Line items table error:', e)
          }
        }

        setInvoices([...invoices, ...data])
        setFormData({
          invoice_number: '',
          client_id: '',
          project_id: '',
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: '',
          invoice_amount: '',
          tax: '',
          retainage: '',
          payment_terms: 'Net 30',
          status: 'draft',
          is_recurring: false,
          recurring_frequency: 'monthly',
        })
        setLineItems([{ description: '', amount: '' }])
        setShowNewInvoiceForm(false)
        alert('Invoice created successfully!')
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create invoice'}`)
    }
  }

  // Handle delete invoice
  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return

    try {
      await supabase.from('invoices').delete().eq('id', id)
      setInvoices(invoices.filter((inv) => inv.id !== id))
    } catch (error) {
      console.error('Error deleting invoice:', error)
    }
  }

  // Handle view invoice (double-click)
  const handleViewInvoice = (invoice: Invoice) => {
    router.push(`/dashboard/invoices/${invoice.id}`)
  }

  const handleDownloadInvoicePDF = async (invoice: Invoice) => {
    try {
      // Get client data
      const clientData = clients.find((c) => c.id === invoice.client_id)

      // Get project data if exists
      let projectData = null
      if (invoice.project_id) {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('id', invoice.project_id)
          .single()
        projectData = data
      }

      // Get line items
      const { data: itemsData } = await supabase
        .from('line_items')
        .select('*')
        .eq('invoice_id', invoice.id)

      // Fetch and convert header image to base64
      let logoImage: string | undefined
      try {
        const response = await fetch('/images/archon-header.png')
        const blob = await response.blob()
        const reader = new FileReader()
        logoImage = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch (error) {
        console.error('Error loading header image:', error)
      }

      const items = itemsData || []
      const total = invoice.invoice_amount + (invoice.tax || 0)

      downloadInvoicePDF(
        {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          clientName: clientData?.name || 'Unknown',
          clientEmail: clientData?.email,
          clientPhone: clientData?.phone,
          projectName: projectData?.project_name,
          projectAddress: projectData?.project_address,
          logoImage: logoImage,
          lineItems: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            amount: item.amount,
          })),
          subtotal: invoice.invoice_amount,
          tax: invoice.tax,
          retainage: invoice.retainage,
          amountPaid: invoice.amount_paid,
          remainingBalance: total - invoice.amount_paid,
          notes: invoice.notes,
          paymentTerms: invoice.payment_terms,
        },
        `${invoice.invoice_number}.pdf`
      )
    } catch (error) {
      console.error('Error downloading invoice PDF:', error)
      alert('Failed to download PDF')
    }
  }

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.name || 'Unknown'
  }

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.project_name || 'N/A'
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    partial: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
  }

  const getOutstandingBalance = (invoice: Invoice) => {
    const total = invoice.invoice_amount + (invoice.invoice_amount * 0.1) // Approximate tax
    return total - invoice.amount_paid
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const exportToCSV = () => {
    const headers = ['Invoice Number', 'Client', 'Project', 'Invoice Date', 'Due Date', 'Amount', 'Outstanding', 'Status']
    const rows = filteredInvoices.map((invoice) => [
      invoice.invoice_number,
      getClientName(invoice.client_id),
      getProjectName(invoice.project_id),
      formatDate(invoice.invoice_date),
      formatDate(invoice.due_date),
      invoice.invoice_amount,
      getOutstandingBalance(invoice),
      invoice.status,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')

    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent))
    element.setAttribute('download', `invoices-${new Date().toISOString().split('T')[0]}.csv`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Invoices</h1>
          <p style={{ color: 'var(--color-muted)' }}>Create and manage client invoices</p>
        </div>
        <button
          onClick={handleOpenNewInvoiceForm}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <Plus className="w-5 h-5" />
          New Invoice
        </button>
      </div>

      {/* New Invoice Form Modal */}
      {showNewInvoiceForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>Create New Invoice</h2>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Invoice Number (Auto-generated)
                </label>
                <input
                  type="text"
                  id="invoices-invoice_number"
                  name="invoice_number"
                  value={formData.invoice_number}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition bg-gray-50"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                />
                <p className="text-xs text-gray-500 mt-1">Invoice numbers are automatically generated</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Client *
                </label>
                <select
                  id="invoices-client_id"
                  name="client_id"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Project
                </label>
                <select
                  id="invoices-project_id"
                  name="project_id"
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    id="invoices-invoice_date"
                    name="invoice_date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    id="invoices-due_date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-muted)' }}>
                  Line Items
                </label>
                <div className="space-y-3 mb-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        id={`invoices-line_description-${index}`}
                        name={`line_description-${index}`}
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...lineItems]
                          newItems[index].description = e.target.value
                          setLineItems(newItems)
                        }}
                        placeholder="Item description"
                        className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                      <input
                        type="number"
                        id={`invoices-line_amount-${index}`}
                        name={`line_amount-${index}`}
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => {
                          const newItems = [...lineItems]
                          newItems[index].amount = e.target.value
                          setLineItems(newItems)
                        }}
                        placeholder="Amount"
                        className="w-24 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                      <button
                        type="button"
                        onClick={() => setLineItems(lineItems.filter((_, i) => i !== index))}
                        className="px-2 py-2 text-red-600 hover:bg-red-50 rounded text-sm flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setLineItems([...lineItems, { description: '', amount: '' }])}
                  className="text-sm px-3 py-1 rounded border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                >
                  + Add Item
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Subtotal (Auto)
                  </label>
                  <input
                    type="number"
                    id="invoices-invoice_amount"
                    name="invoice_amount"
                    step="0.01"
                    value={formData.invoice_amount}
                    readOnly
                    className="w-full px-4 py-2 rounded-lg border bg-gray-50"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Tax
                  </label>
                  <input
                    type="number"
                    id="invoices-tax"
                    name="tax"
                    step="0.01"
                    value={formData.tax}
                    onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Total (Auto)
                  </label>
                  <input
                    type="number"
                    id="invoices-total"
                    name="total"
                    step="0.01"
                    value={(parseFloat(formData.invoice_amount) || 0) + (parseFloat(formData.tax) || 0)}
                    readOnly
                    className="w-full px-4 py-2 rounded-lg border bg-gray-50 font-semibold"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Retainage
                </label>
                <input
                  type="number"
                  id="invoices-retainage"
                  name="retainage"
                  step="0.01"
                  value={formData.retainage}
                  onChange={(e) => setFormData({ ...formData, retainage: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Payment Terms
                </label>
                <select
                  id="invoices-payment_terms"
                  name="payment_terms"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Status
                </label>
                <select
                  id="invoices-status"
                  name="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="invoices-is_recurring"
                    name="is_recurring"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--color-navy)' }}
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                    This is a recurring invoice
                  </span>
                </label>
              </div>

              {formData.is_recurring && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Frequency
                  </label>
                  <select
                    id="invoices-recurring_frequency"
                    name="recurring_frequency"
                    value={formData.recurring_frequency}
                    onChange={(e) => setFormData({ ...formData, recurring_frequency: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Recurring invoices will be automatically generated on schedule</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewInvoiceForm(false)}
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
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          <input
            type="text"
            id="invoices-search"
            name="search"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
          />
        </div>

        <div className="relative">
          <select
            id="invoices-statusFilter"
            name="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border appearance-none pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <button
          onClick={exportToCSV}
          disabled={filteredInvoices.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          title="Export invoices to CSV"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonTable rows={5} />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <p style={{ color: 'var(--color-muted)' }}>No invoices found. Create your first invoice to get started!</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="bg-white rounded-xl p-4 active:opacity-75"
                style={{ border: `1px solid var(--color-border)` }}
                onClick={() => handleViewInvoice(invoice)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: 'var(--color-navy)' }}>{invoice.invoice_number}</p>
                    <p className="font-semibold text-base mt-0.5 truncate" style={{ color: 'var(--color-navy)' }}>{getClientName(invoice.client_id)}</p>
                    <p className="text-sm truncate mt-0.5" style={{ color: 'var(--color-muted)' }}>{getProjectName(invoice.project_id)}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                      Due {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-lg" style={{ color: 'var(--color-navy)' }}>{formatCurrency(invoice.invoice_amount)}</p>
                    {getOutstandingBalance(invoice) > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-destructive)' }}>
                        {formatCurrency(getOutstandingBalance(invoice))} due
                      </p>
                    )}
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${statusColors[invoice.status]}`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadInvoicePDF(invoice) }}
                    className="p-1.5 rounded hover:bg-gray-100 transition"
                    style={{ color: 'var(--color-secondary)' }}
                  >
                    <FileDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice.id) }}
                    className="p-1.5 rounded hover:bg-red-50 transition"
                    style={{ color: 'var(--color-destructive)' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg overflow-x-auto" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
            <table className="w-full min-w-[640px]">
              <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Invoice #</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Client</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Project</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Invoice Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Due Date</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Outstanding</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    style={{ borderBottom: `1px solid var(--color-border)`, cursor: 'pointer' }}
                    className="hover:opacity-75"
                    onDoubleClick={() => handleViewInvoice(invoice)}
                  >
                    <td className="px-6 py-4 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{getClientName(invoice.client_id)}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{getProjectName(invoice.project_id)}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(invoice.invoice_date)}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(invoice.due_date)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                      {formatCurrency(invoice.invoice_amount)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                      {formatCurrency(getOutstandingBalance(invoice))}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[invoice.status]}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        style={{ color: 'var(--color-navy)' }}
                        className="hover:opacity-80 transition"
                        title="View invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadInvoicePDF(invoice)}
                        style={{ color: 'var(--color-secondary)' }}
                        className="hover:opacity-80 transition"
                        title="Download as PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="hover:opacity-80 transition"
                        style={{ color: 'var(--color-destructive)' }}
                        title="Delete invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Invoice Modal */}
    </div>
  )
}
