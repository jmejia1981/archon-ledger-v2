'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  invoice_date: string
  due_date: string
  invoice_amount: number
  amount_paid: number
  status: string
}

interface Client {
  id: string
  name: string
}

export default function ReceivablesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('outstanding')

  const supabase = createClient()

  // Load invoices and clients
  useEffect(() => {
    const loadData = async () => {
      try {
        const [invoicesData, clientsData] = await Promise.all([
          supabase.from('invoices').select('*'),
          supabase.from('clients').select('id, name'),
        ])

        setInvoices(invoicesData.data || [])
        setClients(clientsData.data || [])
      } catch (error) {
        console.log('Error loading data - tables may not exist yet')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Filter and search invoices
  useEffect(() => {
    let filtered = invoices

    // Filter by receivable status
    if (statusFilter === 'outstanding') {
      filtered = filtered.filter((inv) => {
        if (inv.status === 'paid') return false
        const outstanding = inv.invoice_amount - inv.amount_paid
        return outstanding > 0
      })
    } else if (statusFilter === 'overdue') {
      filtered = filtered.filter((inv) => {
        if (inv.status === 'paid') return false
        const outstanding = inv.invoice_amount - inv.amount_paid
        const dueDate = new Date(inv.due_date)
        return outstanding > 0 && dueDate < new Date()
      })
    } else if (statusFilter === 'paid') {
      filtered = filtered.filter((inv) => inv.status === 'paid' || inv.amount_paid >= inv.invoice_amount)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.client_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredInvoices(filtered)
  }, [invoices, statusFilter, searchTerm])

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.name || 'Unknown'
  }

  const getOutstandingBalance = (invoice: Invoice) => {
    return invoice.invoice_amount - invoice.amount_paid
  }

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diffTime = now.getTime() - due.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  const isOverdue = (invoice: Invoice) => {
    const outstanding = getOutstandingBalance(invoice)
    return outstanding > 0 && new Date(invoice.due_date) < new Date()
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
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const calculateMetrics = () => {
    const outstanding = invoices.filter((inv) => {
      const bal = getOutstandingBalance(inv)
      return bal > 0
    })
    const overdue = outstanding.filter((inv) => isOverdue(inv))
    const totalOutstanding = outstanding.reduce((sum, inv) => sum + getOutstandingBalance(inv), 0)
    const totalOverdue = overdue.reduce((sum, inv) => sum + getOutstandingBalance(inv), 0)
    const collectionRate =
      invoices.length > 0
        ? (invoices.reduce((sum, inv) => sum + inv.amount_paid, 0) /
            invoices.reduce((sum, inv) => sum + inv.invoice_amount, 0)) *
          100
        : 0

    return { outstanding: outstanding.length, overdue: overdue.length, totalOutstanding, totalOverdue, collectionRate }
  }

  const metrics = calculateMetrics()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Accounts Receivable</h1>
        <p style={{ color: 'var(--color-muted)' }}>Track customer payments and collections</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ borderColor: 'var(--color-border)', border: '1px solid' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>Outstanding</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(metrics.totalOutstanding)}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{metrics.outstanding} invoices</p>
            </div>
            <Clock className="w-6 h-6" style={{ color: 'var(--color-navy)', opacity: 0.15 }} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ borderColor: 'var(--color-border)', border: '1px solid' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>Overdue</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-destructive)' }}>{formatCurrency(metrics.totalOverdue)}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{metrics.overdue} invoices</p>
            </div>
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-destructive)', opacity: 0.15 }} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ borderColor: 'var(--color-border)', border: '1px solid' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>Collection Rate</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{metrics.collectionRate.toFixed(1)}%</p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>Of invoiced amounts</p>
            </div>
            <CheckCircle className="w-6 h-6" style={{ color: 'var(--color-success)', opacity: 0.15 }} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ borderColor: 'var(--color-border)', border: '1px solid' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>Total Invoiced</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                {formatCurrency(invoices.reduce((sum, inv) => sum + inv.invoice_amount, 0))}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{invoices.length} invoices</p>
            </div>
            <CheckCircle className="w-6 h-6" style={{ color: 'var(--color-navy)', opacity: 0.15 }} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          <input
            type="text"
            id="receivables-search"
            name="search"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition" style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', border: '1px solid' }}
          />
        </div>

        <div className="relative">
          <select
            id="receivables-statusFilter"
            name="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg appearance-none pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition" style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)', border: '1px solid' }}
          >
            <option value="outstanding">Outstanding</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Receivables Table */}
      {loading ? (
        <div className="text-center py-12">
          <p style={{ color: 'var(--color-muted)' }}>Loading invoices...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center" style={{ borderColor: 'var(--color-border)', border: '1px solid' }}>
          <p style={{ color: 'var(--color-muted)' }}>No receivables to display.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)', border: '1px solid' }}>
          <table className="w-full min-w-[640px]">
            <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Invoice #</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Client</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Invoice Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Due Date</th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Invoice Amount</th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Amount Paid</th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Outstanding</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Days Overdue</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: isOverdue(invoice) ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }} className={`${isOverdue(invoice) ? 'hover:bg-red-50' : 'hover:bg-blue-50'}`}>
                  <td className="px-6 py-4 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{invoice.invoice_number}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{getClientName(invoice.client_id)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(invoice.invoice_date)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(invoice.due_date)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(invoice.invoice_amount)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-success)' }}>
                    {formatCurrency(invoice.amount_paid)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: getOutstandingBalance(invoice) > 0 ? 'var(--color-destructive)' : 'var(--color-success)' }}>
                    {formatCurrency(getOutstandingBalance(invoice))}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {isOverdue(invoice) ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-destructive)' }}>
                        {getDaysOverdue(invoice.due_date)} days
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>
                        Due soon
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Aging Report */}
      {filteredInvoices.length > 0 && (
        <div className="bg-white rounded-lg p-6" style={{ borderColor: 'var(--color-border)', border: '1px solid' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>Aging Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Current', days: [0, 30], items: filteredInvoices.filter((inv) => {
                const due = new Date(inv.due_date)
                const diff = Math.ceil((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
                return diff <= 0
              }) },
              { label: '31-60 Days', days: [31, 60], items: filteredInvoices.filter((inv) => {
                const due = new Date(inv.due_date)
                const diff = Math.ceil((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
                return diff > 0 && diff <= 60
              }) },
              { label: '61-90 Days', days: [61, 90], items: filteredInvoices.filter((inv) => {
                const due = new Date(inv.due_date)
                const diff = Math.ceil((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
                return diff > 60 && diff <= 90
              }) },
              { label: '90+ Days', days: [91, Infinity], items: filteredInvoices.filter((inv) => {
                const due = new Date(inv.due_date)
                const diff = Math.ceil((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
                return diff > 90
              }) },
            ].map((bucket) => (
              <div key={bucket.label} className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{bucket.label}</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                  {formatCurrency(bucket.items.reduce((sum, inv) => sum + getOutstandingBalance(inv), 0))}
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{bucket.items.length} invoices</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
