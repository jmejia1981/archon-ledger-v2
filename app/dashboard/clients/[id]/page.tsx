'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Mail, Phone, MapPin, User, Building2, Calendar, CreditCard,
  ArrowLeft, Edit, FileText, DollarSign, TrendingUp,
} from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'

interface Client {
  id: string
  name: string
  company_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  contact_person: string | null
  payment_terms: string | null
  status: 'active' | 'inactive'
  created_at: string
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  invoice_amount: number
  amount_paid: number
  status: string
}

interface Proposal {
  id: string
  proposal_number: string
  proposal_date: string
  total_amount: number
  status: string
  project_name: string | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      try {
        const [clientRes, invoicesRes, proposalsRes] = await Promise.all([
          supabase.from('clients').select('*').eq('id', clientId).single(),
          supabase.from('invoices').select('*').eq('client_id', clientId).order('invoice_date', { ascending: false }),
          supabase.from('proposals').select('*').eq('client_id', clientId).order('proposal_date', { ascending: false }),
        ])
        setClient(clientRes.data)
        setInvoices(invoicesRes.data || [])
        setProposals(proposalsRes.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
  if (!client) return <div className="flex items-center justify-center h-64 text-gray-500">Client not found.</div>

  const totalInvoiced = invoices.reduce((s, i) => s + (i.invoice_amount || 0), 0)
  const totalCollected = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0)
  const outstanding = totalInvoiced - totalCollected
  const openProposals = proposals.filter((p) => p.status === 'pending' || p.status === 'sent').length

  const statusColors: Record<string, { bg: string; color: string }> = {
    paid:     { bg: '#d1fae5', color: '#065f46' },
    sent:     { bg: '#dbeafe', color: '#1e40af' },
    overdue:  { bg: '#fee2e2', color: '#991b1b' },
    draft:    { bg: '#f3f4f6', color: '#374151' },
    pending:  { bg: '#fef3c7', color: '#92400e' },
    accepted: { bg: '#d1fae5', color: '#065f46' },
    declined: { bg: '#fee2e2', color: '#991b1b' },
  }

  const badge = (status: string) => {
    const s = statusColors[status] || { bg: '#f3f4f6', color: '#374151' }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: s.bg, color: s.color }}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Clients', href: '/dashboard/clients' },
        { label: client.name },
      ]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/clients')} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5" style={{ color: 'var(--color-navy)' }} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0" style={{ backgroundColor: 'var(--color-navy)' }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>{client.name}</h1>
              {client.company_name && client.company_name !== client.name && (
                <p className="text-sm text-gray-500">{client.company_name}</p>
              )}
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: client.status === 'active' ? '#e8f5e9' : '#f5f5f5',
                  color: client.status === 'active' ? '#2e7d32' : '#666',
                }}
              >
                {client.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/dashboard/clients?edit=${client.id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition hover:bg-gray-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
          >
            <Edit className="w-4 h-4" /> Edit
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced', value: fmt(totalInvoiced), icon: FileText },
          { label: 'Collected', value: fmt(totalCollected), icon: DollarSign },
          { label: 'Outstanding', value: fmt(outstanding), icon: TrendingUp },
          { label: 'Open Proposals', value: String(openProposals), icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color: 'var(--color-navy)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Client Info */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-muted)' }}>Contact</h2>
            <div className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-navy)' }} />
                  <a href={`mailto:${client.email}`} className="text-sm hover:underline" style={{ color: 'var(--color-navy)' }}>{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-navy)' }} />
                  <a href={`tel:${client.phone}`} className="text-sm hover:underline" style={{ color: 'var(--color-navy)' }}>{client.phone}</a>
                </div>
              )}
              {client.contact_person && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-navy)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-navy)' }}>{client.contact_person}</span>
                </div>
              )}
              {client.company_name && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-navy)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-navy)' }}>{client.company_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          {(client.address || client.city) && (
            <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-muted)' }}>Address</h2>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-navy)' }} />
                <div className="text-sm space-y-0.5" style={{ color: 'var(--color-navy)' }}>
                  {client.address && <p>{client.address}</p>}
                  {(client.city || client.state || client.zip) && (
                    <p>{[client.city, client.state, client.zip].filter(Boolean).join(', ')}</p>
                  )}
                  {client.country && <p>{client.country}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Business */}
          <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-muted)' }}>Business</h2>
            <div className="space-y-3">
              {client.payment_terms && (
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-navy)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-navy)' }}>{client.payment_terms}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-navy)' }} />
                <span className="text-sm" style={{ color: 'var(--color-navy)' }}>
                  Client since {new Date(client.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Invoices + Proposals */}
        <div className="lg:col-span-2 space-y-6">

          {/* Invoices */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-linen)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Invoices ({invoices.length})</h2>
              <button onClick={() => router.push('/dashboard/invoices')} className="text-xs hover:underline" style={{ color: 'var(--color-navy)' }}>View all</button>
            </div>
            {invoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No invoices yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    {['Invoice #', 'Date', 'Amount', 'Paid', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t hover:bg-gray-50 cursor-pointer transition"
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}>
                      <td className="px-4 py-3 text-sm font-mono font-medium" style={{ color: 'var(--color-navy)' }}>{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                        {new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{fmt(inv.invoice_amount)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#10b981' }}>{fmt(inv.amount_paid)}</td>
                      <td className="px-4 py-3">{badge(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Proposals */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-linen)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Proposals ({proposals.length})</h2>
              <button onClick={() => router.push('/dashboard/proposals')} className="text-xs hover:underline" style={{ color: 'var(--color-navy)' }}>View all</button>
            </div>
            {proposals.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No proposals yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    {['Proposal #', 'Date', 'Project', 'Amount', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-gray-50 cursor-pointer transition"
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => router.push(`/dashboard/proposals/${p.id}`)}>
                      <td className="px-4 py-3 text-sm font-mono font-medium" style={{ color: 'var(--color-navy)' }}>
                        {p.proposal_number.startsWith('PROP-') ? p.proposal_number : `PROP-${p.proposal_number}`}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                        {new Date(p.proposal_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{p.project_name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{fmt(p.total_amount)}</td>
                      <td className="px-4 py-3">{badge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
