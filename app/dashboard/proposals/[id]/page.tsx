'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Download, FileText, CheckCircle, Plus, Mail } from 'lucide-react'
import { SkeletonTable } from '@/app/components/skeleton-loader'
import { downloadProposalPDF } from '@/lib/pdf-proposal'

interface Proposal {
  id: string
  proposal_number: string
  client_id: string
  client_name: string
  client_email?: string
  project_name: string
  project_address: string
  project_city?: string
  project_state?: string
  project_zip?: string
  proposal_date: string
  expiration_date: string
  valid_for?: string
  scope_of_work?: string
  inclusions?: string
  exclusions?: string
  subtotal: number
  tax: number
  total_amount: number
  terms: string
  notes: string
  status: string
  created_at: string
  updated_at: string
}

interface ProposalItem {
  id: string
  proposal_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface LineItem {
  description: string
  amount: string
}

export default function ProposalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const proposalId = params.id as string

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [lineItems, setLineItems] = useState<ProposalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showSaveClientModal, setShowSaveClientModal] = useState(false)
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')

  const [formData, setFormData] = useState<Partial<Proposal>>({})
  const [, setEditLineItems] = useState<LineItem[]>([])

  const supabase = createClient()
  const editFormRef = useRef<HTMLDivElement>(null)

  // Load proposal and line items
  useEffect(() => {
    const loadProposal = async () => {
      try {
        const [proposalData, itemsData] = await Promise.all([
          supabase.from('proposals').select('*').eq('id', proposalId).single(),
          supabase.from('proposal_items').select('*').eq('proposal_id', proposalId),
        ])

        if (proposalData.data) {
          setProposal(proposalData.data)
          setFormData(proposalData.data)
        }

        if (itemsData.data) {
          setLineItems(itemsData.data)
          setEditLineItems(
            itemsData.data.map(item => ({
              description: item.description,
              amount: item.amount.toString(),
            }))
          )
        }
      } catch (error) {
        console.error('Error loading proposal:', error)
        alert('Failed to load proposal')
      } finally {
        setLoading(false)
      }
    }

    if (proposalId) {
      loadProposal()
    }
  }, [proposalId, supabase])

  // Handle save changes
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proposal) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('proposals')
        .update({
          status: formData.status || proposal.status,
          terms: formData.terms || proposal.terms,
          notes: formData.notes || proposal.notes,
        })
        .eq('id', proposal.id)

      if (error) throw error

      setProposal(prev => prev ? { ...prev, ...formData } : null)
      setIsEditing(false)
      alert('Proposal updated successfully!')
    } catch (error) {
      console.error('Error saving proposal:', error)
      alert('Failed to save proposal')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle approve proposal (convert to project and update status)
  const handleApproveProposal = async () => {
    if (!proposal || !confirm('Are you sure you want to approve this proposal? It will create an active project.')) return

    setIsApproving(true)
    try {
      // Create new project from proposal
      const { error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            project_name: proposal.project_name,
            client_id: proposal.client_id || null,
            project_address: proposal.project_address,
            status: 'active',
            contract_budget: proposal.total_amount,
          },
        ])
        .select()

      if (projectError) throw projectError

      // Update proposal status to accepted
      const { error: updateError } = await supabase
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', proposal.id)

      if (updateError) throw updateError

      setProposal(prev => prev ? { ...prev, status: 'accepted' } : null)

      // Check if client exists, if not show modal to save new client
      if (!proposal.client_id) {
        setShowSaveClientModal(true)
      } else {
        alert('Proposal approved! Project created successfully.')
        router.push('/dashboard/projects')
      }
    } catch (error) {
      console.error('Error approving proposal:', error)
      alert('Failed to approve proposal')
    } finally {
      setIsApproving(false)
    }
  }

  // Handle save new client
  const handleSaveNewClient = async () => {
    if (!proposal || !proposal.client_name) return

    try {
      const { error } = await supabase
        .from('clients')
        .insert([
          {
            name: proposal.client_name,
            email: newClientEmail || null,
            phone: newClientPhone || null,
          },
        ])
        .select()

      if (error) throw error

      alert('Client saved successfully!')
      setShowSaveClientModal(false)
      router.push('/dashboard/projects')
    } catch (error) {
      console.error('Error saving client:', error)
      alert('Failed to save client')
    }
  }

  // Shared helper: fetch company + client data and logo for PDF
  const buildPDFPayload = async () => {
    if (!proposal) return null

    const scopeOfWork = (proposal.scope_of_work || '').split('\n').map(s => s.trim()).filter(s => s)
    const inclusions = (proposal.inclusions || '').split('\n').map(s => s.trim()).filter(s => s)
    const exclusions = (proposal.exclusions || '').split('\n').map(s => s.trim()).filter(s => s)

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

    let companyName = 'Archon Construction LLC'
    let companyEmail = ''
    let companyPhone = ''
    let companyAddress = ''
    let companyCity = ''
    let companyState = ''
    let companyZip = ''
    const { data: companyData, error: companyError } = await supabase
      .from('company_settings')
      .select('name, email, phone, address, city, state, zip')
      .eq('id', 1)
      .single()
    if (companyError) {
      console.error('company_settings fetch error:', companyError)
    } else if (companyData) {
      companyName = (companyData as any).name || companyName
      companyEmail = (companyData as any).email || ''
      companyPhone = (companyData as any).phone || ''
      companyAddress = (companyData as any).address || ''
      companyCity = (companyData as any).city || ''
      companyState = (companyData as any).state || ''
      companyZip = (companyData as any).zip || ''
    }

    let clientCompany = ''
    let clientPhone = ''
    if (proposal.client_id) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('company_name, phone')
        .eq('id', proposal.client_id)
        .single()
      if (clientError) {
        console.error('client fetch error:', clientError)
      } else if (clientData) {
        clientCompany = (clientData as any).company_name || ''
        clientPhone = (clientData as any).phone || ''
      }
    }

    return {
      proposalNumber: proposal.proposal_number,
      proposalDate: proposal.proposal_date,
      expirationDate: proposal.expiration_date,
      clientName: proposal.client_name,
      clientCompany,
      clientEmail: proposal.client_email || '',
      clientPhone,
      projectName: proposal.project_name,
      projectAddress: proposal.project_address,
      projectCity: proposal.project_city || '',
      projectState: proposal.project_state || '',
      projectZip: proposal.project_zip || '',
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      companyCity,
      companyState,
      companyZip,
      logoImage,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.amount,
      })),
      subtotal: proposal.subtotal,
      tax: proposal.tax,
      totalAmount: proposal.total_amount,
      terms: proposal.terms,
      notes: proposal.notes,
      scopeOfWork,
      inclusions,
      exclusions,
      validFor: proposal.valid_for || '30 Days from Date Issued',
    }
  }

  // Handle export to PDF
  const handleExportPDF = async () => {
    const payload = await buildPDFPayload()
    if (payload) downloadProposalPDF(payload)
  }

  // Handle email to client
  const handleEmailClient = async () => {
    if (!proposal) return

    // First, download the PDF with full company/client info
    const payload = await buildPDFPayload()
    if (payload) downloadProposalPDF(payload)

    // Then, open default email client
    const clientEmail = proposal.client_email || ''
    const subject = encodeURIComponent(`Proposal ${proposal.proposal_number} - ${proposal.project_name}`)
    const body = encodeURIComponent(`Hi ${proposal.client_name},\n\nPlease find attached the proposal for ${proposal.project_name}.\n\nPlease let me know if you have any questions.\n\nBest regards,\nArchon Construction`)

    // Open mailto link
    window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`
  }

  // Handle convert to invoice
  const handleConvertToInvoice = async () => {
    if (!proposal) return

    try {
      // Create invoice from proposal data
      const invoiceDate = new Date().toISOString().split('T')[0]
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: '',
            client_id: proposal.client_id || null,
            client_name: proposal.client_name,
            project_name: proposal.project_name,
            project_address: proposal.project_address,
            invoice_date: invoiceDate,
            due_date: dueDate,
            invoice_amount: proposal.total_amount,
            tax: proposal.tax,
            status: 'draft',
            payment_terms: 'Net 30',
            notes: proposal.notes,
            created_at: new Date().toISOString(),
          },
        ])
        .select()

      if (invoiceError) throw invoiceError

      if (invoiceData && invoiceData[0]) {
        const invoiceId = invoiceData[0].id

        // Add line items to invoice
        if (lineItems.length > 0) {
          const itemsToInsert = lineItems.map(item => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          }))

          try {
            await supabase.from('line_items').insert(itemsToInsert)
          } catch (e) {
            console.error('Error adding line items to invoice:', e)
          }
        }

        alert('Proposal converted to invoice successfully!')
        router.push(`/dashboard/invoices/${invoiceId}`)
      }
    } catch (error) {
      console.error('Error converting to invoice:', error)
      alert('Failed to convert proposal to invoice')
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-yellow-100 text-yellow-800',
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonTable rows={5} />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
        <p style={{ color: 'var(--color-muted)' }}>Proposal not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Save New Client Modal */}
      {showSaveClientModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg p-8 max-w-md w-full" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-navy)' }}>Save New Client</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveNewClient(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Client Name
                </label>
                <input
                  type="text"
                  value={proposal.client_name}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border bg-gray-50"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="Enter client email"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Enter client phone"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveClientModal(false)
                    router.push('/dashboard/projects')
                  }}
                  className="flex-1 px-4 py-2 rounded-lg hover:opacity-80 transition"
                  style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                  style={{ backgroundColor: 'var(--color-navy)' }}
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:opacity-80 transition"
            style={{ color: 'var(--color-navy)' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>
              {proposal.proposal_number}
            </h1>
            <p style={{ color: 'var(--color-muted)' }}>{proposal.client_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {proposal.status === 'draft' && (
            <button
              onClick={handleApproveProposal}
              disabled={isApproving}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition font-medium disabled:opacity-50"
              style={{ backgroundColor: '#28a745' }}
              title="Approve proposal and create project"
            >
              <CheckCircle className="w-4 h-4" />
              {isApproving ? 'Approving...' : 'Approve'}
            </button>
          )}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition font-medium"
            style={{ backgroundColor: '#0066cc' }}
            title="Download proposal as PDF"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[proposal.status]}`}>
            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Section - Proposal Details */}
        <div className="col-span-2 space-y-6">
          {/* Quick Stats */}
          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Proposal Date</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>
                  {formatDate(proposal.proposal_date)}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Expiration Date</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>
                  {proposal.expiration_date ? formatDate(proposal.expiration_date) : 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Total Amount</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
                  {formatCurrency(proposal.total_amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Proposal Line Items */}
          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-navy)' }}>
                      Description
                    </th>
                    <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-navy)' }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
                      <td colSpan={2} className="px-4 py-3 text-center" style={{ color: 'var(--color-muted)' }}>
                        No line items
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, index) => (
                      <tr key={index} style={{ borderBottom: `1px solid var(--color-border)` }}>
                        <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>
                          {item.description}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-navy)' }}>
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 pt-6" style={{ borderTop: `1px solid var(--color-border)` }}>
              <div className="flex justify-end gap-8">
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Subtotal</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(proposal.subtotal)}
                  </p>
                </div>
                {proposal.tax > 0 && (
                  <div>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Tax</p>
                    <p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>
                      {formatCurrency(proposal.tax)}
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Total</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {formatCurrency(proposal.total_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          {proposal.terms && (
            <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
              <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-navy)' }}>Terms & Conditions</h2>
              <p style={{ color: 'var(--color-muted)', whiteSpace: 'pre-wrap' }}>{proposal.terms}</p>
            </div>
          )}

          {/* Notes */}
          {proposal.notes && (
            <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
              <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-navy)' }}>Notes</h2>
              <p style={{ color: 'var(--color-muted)', whiteSpace: 'pre-wrap' }}>{proposal.notes}</p>
            </div>
          )}
        </div>

        {/* Right Section - Actions and Edit */}
        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="rounded-lg p-6 space-y-3" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
            <button
              onClick={handleEmailClient}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: '#0066cc' }}
            >
              <Mail className="w-4 h-4" />
              Email to Client
            </button>

            <button
              onClick={handleExportPDF}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <Download className="w-4 h-4" />
              Export to PDF
            </button>

            <button
              onClick={handleConvertToInvoice}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-muted)' }}
            >
              <FileText className="w-4 h-4" />
              Convert to Invoice
            </button>

            <button
              onClick={() => {
                setIsEditing(!isEditing)
                if (!isEditing) {
                  setTimeout(() => editFormRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg hover:opacity-80 transition"
              style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white', color: 'var(--color-navy)' }}
            >
              <Plus className="w-4 h-4" />
              {isEditing ? 'Cancel Edit' : 'Edit Details'}
            </button>
          </div>

          {/* Client Info */}
          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>CLIENT INFORMATION</h3>
            <div className="space-y-2">
              <div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>Name</p>
                <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                  {proposal.client_name}
                </p>
              </div>
              {proposal.client_email && (
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>Email</p>
                  <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                    {proposal.client_email}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Project Info */}
          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>PROJECT INFORMATION</h3>
            <div className="space-y-2">
              <div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>Project Name</p>
                <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                  {proposal.project_name}
                </p>
              </div>
              {proposal.project_address && (
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>Address</p>
                  <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                    {proposal.project_address}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div ref={editFormRef} className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--color-navy)' }}>Edit Proposal</h2>
          <form onSubmit={handleSaveChanges} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                Status
              </label>
              <select
                value={formData.status || proposal.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                Terms & Conditions
              </label>
              <textarea
                value={formData.terms || proposal.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                Notes
              </label>
              <textarea
                value={formData.notes || proposal.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 rounded-lg hover:opacity-80 transition"
                style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white', color: 'var(--color-navy)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
