'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Download, FileText, CheckCircle, Edit2, X, Save, Mail, Plus, Trash2 } from 'lucide-react'
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
  project_id?: string
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

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  primary_contact?: string
  company_name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

interface Project {
  id: string
  project_name: string
  project_number: string
}

interface LineItem {
  description: string
  amount: string
}

const supabase = createClient()

export default function ProposalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const proposalId = params.id as string

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [lineItems, setLineItems] = useState<ProposalItem[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showSaveClientModal, setShowSaveClientModal] = useState(false)
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Edit form state
  const [editData, setEditData] = useState<Partial<Proposal>>({})
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([])

  const editFormRef = useRef<HTMLDivElement>(null)

  // Load proposal, line items, and clients
  useEffect(() => {
    const loadProposal = async () => {
      try {
        const [proposalRes, itemsRes, clientsRes, projectsRes] = await Promise.all([
          supabase.from('proposals').select('*').eq('id', proposalId).single(),
          supabase.from('proposal_items').select('*').eq('proposal_id', proposalId),
          supabase.from('clients').select('id, name, email, phone, primary_contact, company_name, address, city, state, zip'),
          supabase.from('projects').select('id, project_name, project_number').order('project_number', { ascending: true }),
        ])

        if (proposalRes.data) {
          setProposal(proposalRes.data)
          setEditData(proposalRes.data)
        }
        if (itemsRes.data) {
          setLineItems(itemsRes.data)
          setEditLineItems(itemsRes.data.map(i => ({ description: i.description, amount: i.amount.toString() })))
        }
        setClients(clientsRes.data || [])
        setProjects(projectsRes.data || [])
      } catch (error) {
        console.error('Error loading proposal:', error)
      } finally {
        setLoading(false)
      }
    }
    if (proposalId) loadProposal()
  }, [proposalId])

  // Auto-recalculate subtotal from edit line items
  useEffect(() => {
    const subtotal = editLineItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
    setEditData(prev => ({ ...prev, subtotal }))
  }, [editLineItems])

  const openEdit = () => {
    if (!proposal) return
    setEditData(proposal)
    setEditLineItems(lineItems.map(i => ({ description: i.description, amount: i.amount.toString() })))
    setSaveError(null)
    setIsEditing(true)
    setTimeout(() => editFormRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // Save all changes + sync linked project
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proposal) return
    setIsSaving(true)
    setSaveError(null)

    try {
      const subtotal = editLineItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
      const tax = parseFloat(String(editData.tax)) || 0
      const total_amount = subtotal + tax

      // 1. Update proposal (including project_id link)
      const { error: propError } = await supabase
        .from('proposals')
        .update({
          client_name: editData.client_name,
          client_email: editData.client_email || null,
          client_id: editData.client_id || null,
          project_name: editData.project_name,
          project_address: editData.project_address,
          project_city: editData.project_city || null,
          project_state: editData.project_state || null,
          project_zip: editData.project_zip || null,
          proposal_date: editData.proposal_date,
          expiration_date: editData.expiration_date || null,
          valid_for: editData.valid_for || null,
          scope_of_work: editData.scope_of_work || null,
          inclusions: editData.inclusions || null,
          exclusions: editData.exclusions || null,
          subtotal,
          tax,
          total_amount,
          terms: editData.terms || null,
          notes: editData.notes || null,
          status: editData.status || proposal.status,
          project_id: editData.project_id || null,
        })
        .eq('id', proposal.id)

      if (propError) throw propError

      // 2. Replace line items
      await supabase.from('proposal_items').delete().eq('proposal_id', proposal.id)
      const validItems = editLineItems.filter(i => i.description.trim())
      if (validItems.length > 0) {
        await supabase.from('proposal_items').insert(
          validItems.map(i => ({
            proposal_id: proposal.id,
            description: i.description,
            quantity: 1,
            unit_price: parseFloat(i.amount) || 0,
            amount: parseFloat(i.amount) || 0,
          }))
        )
      }

      // 3. Sync to linked project (use editData.project_id so manually linked projects work too)
      const linkedProjectId = editData.project_id || proposal.project_id
      if (linkedProjectId) {
        const { error: projSyncError } = await supabase
          .from('projects')
          .update({
            project_name: editData.project_name,
            project_address: editData.project_address,
            client_id: editData.client_id || null,
            contract_budget: total_amount,
          })
          .eq('id', linkedProjectId)
        if (projSyncError) console.error('Project sync error:', projSyncError)
      }

      // 4. Refresh local state
      const [updatedProp, updatedItems] = await Promise.all([
        supabase.from('proposals').select('*').eq('id', proposal.id).single(),
        supabase.from('proposal_items').select('*').eq('proposal_id', proposal.id),
      ])
      if (updatedProp.data) {
        setProposal(updatedProp.data)
        setEditData(updatedProp.data)
      }
      if (updatedItems.data) {
        setLineItems(updatedItems.data)
        setEditLineItems(updatedItems.data.map(i => ({ description: i.description, amount: i.amount.toString() })))
      }
      setIsEditing(false)
    } catch (err: any) {
      console.error('Save error:', err)
      setSaveError(err?.message || 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Approve proposal → create project → link back
  const handleApproveProposal = async () => {
    if (!proposal || !confirm('Approve this proposal? It will create an active project.')) return
    setIsApproving(true)
    try {
      const { data: existingProjects } = await supabase.from('projects').select('project_number')
      const numbers = (existingProjects || []).map((p: any) => parseInt(p.project_number)).filter((n: number) => !isNaN(n))
      const nextProjectNumber = (Math.max(...numbers, 99) + 1).toString()

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([{
          project_number: nextProjectNumber,
          project_name: proposal.project_name,
          client_id: proposal.client_id || null,
          project_address: proposal.project_address,
          status: 'active',
          contract_budget: proposal.total_amount,
        }])
        .select()
        .single()

      if (projectError) throw projectError

      // Link proposal to the created project
      await supabase
        .from('proposals')
        .update({ status: 'accepted', project_id: projectData.id })
        .eq('id', proposal.id)

      setProposal(prev => prev ? { ...prev, status: 'accepted', project_id: projectData.id } : null)

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

  const handleSaveNewClient = async () => {
    if (!proposal || !proposal.client_name) return
    try {
      const { error } = await supabase.from('clients').insert([{
        name: proposal.client_name,
        email: newClientEmail || null,
        phone: newClientPhone || null,
      }]).select()
      if (error) throw error
      setShowSaveClientModal(false)
      router.push('/dashboard/projects')
    } catch (error) {
      console.error('Error saving client:', error)
      alert('Failed to save client')
    }
  }

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
      logoImage = await new Promise<string>((resolve) => { reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(blob) })
    } catch {}

    let companyName = 'Archon Construction LLC', companyEmail = '', companyPhone = '', companyAddress = '', companyCity = '', companyState = '', companyZip = ''
    const { data: co } = await supabase.from('company_settings').select('name, email, phone, address, city, state, zip').eq('id', 1).single()
    if (co) { companyName = co.name || companyName; companyEmail = co.email || ''; companyPhone = co.phone || ''; companyAddress = co.address || ''; companyCity = co.city || ''; companyState = co.state || ''; companyZip = co.zip || '' }

    let clientCompany = '', clientPhone = '', clientAddress = '', clientCity = '', clientState = '', clientZip = ''
    if (proposal.client_id) {
      const { data: cl } = await supabase.from('clients').select('company_name, phone, email, address, city, state, zip').eq('id', proposal.client_id).single()
      if (cl) { clientCompany = cl.company_name || ''; clientPhone = cl.phone || ''; clientAddress = cl.address || ''; clientCity = cl.city || ''; clientState = cl.state || ''; clientZip = cl.zip || '' }
    }

    return {
      proposalNumber: proposal.proposal_number, proposalDate: proposal.proposal_date, expirationDate: proposal.expiration_date,
      clientName: proposal.client_name, clientCompany, clientEmail: proposal.client_email || '', clientPhone, clientAddress, clientCity, clientState, clientZip,
      projectName: proposal.project_name, projectAddress: proposal.project_address, projectCity: proposal.project_city || '', projectState: proposal.project_state || '', projectZip: proposal.project_zip || '',
      companyName, companyEmail, companyPhone, companyAddress, companyCity, companyState, companyZip, logoImage,
      lineItems: lineItems.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unit_price, amount: i.amount })),
      subtotal: proposal.subtotal, tax: proposal.tax, totalAmount: proposal.total_amount,
      terms: proposal.terms, notes: proposal.notes, scopeOfWork, inclusions, exclusions, validFor: proposal.valid_for || '30 Days from Date Issued',
    }
  }

  const handleExportPDF = async () => { const p = await buildPDFPayload(); if (p) downloadProposalPDF(p) }
  const handleEmailClient = async () => {
    const p = await buildPDFPayload(); if (p) downloadProposalPDF(p)
    const subject = encodeURIComponent(`Proposal ${proposal!.proposal_number} - ${proposal!.project_name}`)
    const body = encodeURIComponent(`Hi ${proposal!.client_name},\n\nPlease find attached the proposal for ${proposal!.project_name}.\n\nBest regards,\nArchon Construction`)
    window.location.href = `mailto:${proposal!.client_email || ''}?subject=${subject}&body=${body}`
  }
  const handleConvertToInvoice = async () => {
    if (!proposal) return
    try {
      const { data: invData, error } = await supabase.from('invoices').insert([{
        invoice_number: '', client_id: proposal.client_id || null, client_name: proposal.client_name,
        project_name: proposal.project_name, project_address: proposal.project_address,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        invoice_amount: proposal.total_amount, tax: proposal.tax, status: 'draft', payment_terms: 'Net 30', notes: proposal.notes,
      }]).select()
      if (error) throw error
      if (invData?.[0]) {
        if (lineItems.length > 0) await supabase.from('line_items').insert(lineItems.map(i => ({ invoice_id: invData[0].id, description: i.description, quantity: i.quantity, unit_price: i.unit_price, amount: i.amount })))
        alert('Converted to invoice!'); router.push(`/dashboard/invoices/${invData[0].id}`)
      }
    } catch (e) { console.error(e); alert('Failed to convert to invoice') }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800', sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', expired: 'bg-yellow-100 text-yellow-800',
  }
  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
  const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'white' }
  const labelCls = "block text-xs font-medium mb-1"

  if (loading) return <div className="space-y-4"><SkeletonTable rows={5} /></div>
  if (!proposal) return <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}><p style={{ color: 'var(--color-muted)' }}>Proposal not found</p></div>

  const editSubtotal = editLineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const editTax = parseFloat(String(editData.tax)) || 0
  const editTotal = editSubtotal + editTax

  return (
    <div className="space-y-6">
      {/* Save New Client Modal */}
      {showSaveClientModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-lg p-8 max-w-md w-full" style={{ border: '1px solid var(--color-border)' }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--color-navy)' }}>Save New Client</h2>
            <form onSubmit={e => { e.preventDefault(); handleSaveNewClient() }} className="space-y-4">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Client Name</label>
                <input type="text" value={proposal.client_name} readOnly className={inputCls + ' bg-gray-50'} style={{ borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Email</label>
                <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="Enter client email" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Phone</label>
                <input type="tel" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="Enter client phone" className={inputCls} style={inputStyle} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowSaveClientModal(false); router.push('/dashboard/projects') }}
                  className="flex-1 px-4 py-2 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>Skip</button>
                <button type="submit" className="flex-1 px-4 py-2 text-white rounded-lg" style={{ backgroundColor: 'var(--color-navy)' }}>Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 hover:opacity-80 transition flex-shrink-0 mt-1" style={{ color: 'var(--color-navy)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{proposal.proposal_number}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[proposal.status]}`}>
              {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
            </span>
            {proposal.project_id && (
              <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                ✓ Linked to Project
              </span>
            )}
          </div>
          <p style={{ color: 'var(--color-muted)' }}>{proposal.client_name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {proposal.status === 'draft' && (
            <button onClick={handleApproveProposal} disabled={isApproving}
              className="flex items-center gap-1.5 px-3 py-2 text-white rounded-lg font-medium text-sm disabled:opacity-50"
              style={{ backgroundColor: '#28a745' }}>
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{isApproving ? 'Approving...' : 'Approve'}</span>
            </button>
          )}
          <button onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-white rounded-lg font-medium text-sm"
            style={{ backgroundColor: '#0066cc' }}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Stats */}
          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><p className="text-sm" style={{ color: 'var(--color-muted)' }}>Proposal Date</p><p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>{fmtDate(proposal.proposal_date)}</p></div>
              <div><p className="text-sm" style={{ color: 'var(--color-muted)' }}>Expiration Date</p><p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>{fmtDate(proposal.expiration_date)}</p></div>
              <div><p className="text-sm" style={{ color: 'var(--color-muted)' }}>Total Amount</p><p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>{fmt(proposal.total_amount)}</p></div>
            </div>
          </div>

          {/* Scope / Inclusions / Exclusions */}
          {(proposal.scope_of_work || proposal.inclusions || proposal.exclusions) && (
            <div className="rounded-lg p-6 space-y-4" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
              {proposal.scope_of_work && (<div><h2 className="text-base font-bold mb-2" style={{ color: 'var(--color-navy)' }}>Scope of Work</h2><p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>{proposal.scope_of_work}</p></div>)}
              {proposal.inclusions && (<div><h2 className="text-base font-bold mb-2" style={{ color: 'var(--color-navy)' }}>Inclusions</h2><p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>{proposal.inclusions}</p></div>)}
              {proposal.exclusions && (<div><h2 className="text-base font-bold mb-2" style={{ color: 'var(--color-navy)' }}>Exclusions</h2><p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>{proposal.exclusions}</p></div>)}
            </div>
          )}

          {/* Line Items */}
          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>Line Items</h2>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-navy)' }}>Description</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-navy)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0
                  ? <tr><td colSpan={2} className="px-4 py-3 text-center" style={{ color: 'var(--color-muted)' }}>No line items</td></tr>
                  : lineItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>{item.description}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-navy)' }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="mt-6 pt-6 flex justify-end gap-8" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div><p className="text-sm" style={{ color: 'var(--color-muted)' }}>Subtotal</p><p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>{fmt(proposal.subtotal)}</p></div>
              {proposal.tax > 0 && <div><p className="text-sm" style={{ color: 'var(--color-muted)' }}>Tax</p><p className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>{fmt(proposal.tax)}</p></div>}
              <div><p className="text-sm" style={{ color: 'var(--color-muted)' }}>Total</p><p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>{fmt(proposal.total_amount)}</p></div>
            </div>
          </div>

          {proposal.terms && (
            <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
              <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-navy)' }}>Terms & Conditions</h2>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>{proposal.terms}</p>
            </div>
          )}
          {proposal.notes && (
            <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
              <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-navy)' }}>Notes</h2>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>{proposal.notes}</p>
            </div>
          )}
        </div>

        {/* Right — actions + info */}
        <div className="space-y-6">
          <div className="rounded-lg p-6 space-y-3" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
            <button onClick={openEdit}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-navy)' }}>
              <Edit2 className="w-4 h-4" /> Edit Proposal
            </button>
            <button onClick={handleEmailClient}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: '#0066cc' }}>
              <Mail className="w-4 h-4" /> Email to Client
            </button>
            <button onClick={handleExportPDF}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-secondary)' }}>
              <Download className="w-4 h-4" /> Export to PDF
            </button>
            <button onClick={handleConvertToInvoice}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-muted)' }}>
              <FileText className="w-4 h-4" /> Convert to Invoice
            </button>
          </div>

          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
            <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>CLIENT</h3>
            <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{proposal.client_name}</p>
            {proposal.client_email && <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>{proposal.client_email}</p>}
          </div>

          <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
            <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>PROJECT</h3>
            <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{proposal.project_name || '—'}</p>
            {proposal.project_address && <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>{proposal.project_address}</p>}
            {(proposal.project_city || proposal.project_state) && (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                {[proposal.project_city, proposal.project_state, proposal.project_zip].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Full Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setIsEditing(false) }}>
          <div ref={editFormRef} className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>Edit Proposal</h2>
                {proposal.project_id && (
                  <p className="text-xs mt-0.5" style={{ color: '#059669' }}>Changes will also update the linked project</p>
                )}
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
              </button>
            </div>

            <form onSubmit={handleSaveChanges} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Status */}
              <div>
                <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Status</label>
                <select value={editData.status || ''} onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}
                  className={inputCls} style={{ ...inputStyle, color: 'var(--color-navy)' }}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              {/* Linked Project */}
              <div>
                <label className={labelCls} style={{ color: 'var(--color-muted)' }}>
                  Linked Project <span className="font-normal">(budget & name will sync on save)</span>
                </label>
                <select
                  value={editData.project_id || ''}
                  onChange={e => setEditData(p => ({ ...p, project_id: e.target.value || undefined }))}
                  className={inputCls}
                  style={{ ...inputStyle, color: 'var(--color-navy)' }}
                >
                  <option value="">— Not linked —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>#{p.project_number} — {p.project_name}</option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Proposal Date</label>
                  <input type="date" value={editData.proposal_date || ''} onChange={e => setEditData(p => ({ ...p, proposal_date: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Expiration Date</label>
                  <input type="date" value={editData.expiration_date || ''} onChange={e => setEditData(p => ({ ...p, expiration_date: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Client */}
              <div className="pt-1 pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--color-navy)' }}>Client Information</h3>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Select Existing Client</label>
                  <select value={editData.client_id || ''} onChange={e => {
                    const id = e.target.value
                    const cl = clients.find(c => c.id === id)
                    setEditData(p => ({ ...p, client_id: id, client_name: cl?.name || p.client_name, client_email: cl?.email || p.client_email }))
                  }} className={inputCls + ' mb-3'} style={{ ...inputStyle, color: 'var(--color-navy)' }}>
                    <option value="">— Type manually —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Client Name *</label>
                    <input value={editData.client_name || ''} onChange={e => setEditData(p => ({ ...p, client_name: e.target.value }))} required className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Client Email</label>
                    <input type="email" value={editData.client_email || ''} onChange={e => setEditData(p => ({ ...p, client_email: e.target.value }))} className={inputCls} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Project */}
              <div className="pt-1 pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--color-navy)' }}>Project Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Project Name</label>
                    <input value={editData.project_name || ''} onChange={e => setEditData(p => ({ ...p, project_name: e.target.value }))} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Project Address</label>
                    <input value={editData.project_address || ''} onChange={e => setEditData(p => ({ ...p, project_address: e.target.value }))} className={inputCls} style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls} style={{ color: 'var(--color-muted)' }}>City</label>
                      <input value={editData.project_city || ''} onChange={e => setEditData(p => ({ ...p, project_city: e.target.value }))} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--color-muted)' }}>State</label>
                      <input value={editData.project_state || ''} onChange={e => setEditData(p => ({ ...p, project_state: e.target.value }))} maxLength={2} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--color-muted)' }}>ZIP</label>
                      <input value={editData.project_zip || ''} onChange={e => setEditData(p => ({ ...p, project_zip: e.target.value }))} className={inputCls} style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Scope / Inclusions / Exclusions */}
              <div className="space-y-3">
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Scope of Work</label>
                  <textarea value={editData.scope_of_work || ''} onChange={e => setEditData(p => ({ ...p, scope_of_work: e.target.value }))}
                    rows={3} className={inputCls + ' resize-none font-mono text-xs'} style={inputStyle} placeholder="One item per line" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Inclusions</label>
                  <textarea value={editData.inclusions || ''} onChange={e => setEditData(p => ({ ...p, inclusions: e.target.value }))}
                    rows={3} className={inputCls + ' resize-none font-mono text-xs'} style={inputStyle} placeholder="One item per line" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Exclusions</label>
                  <textarea value={editData.exclusions || ''} onChange={e => setEditData(p => ({ ...p, exclusions: e.target.value }))}
                    rows={3} className={inputCls + ' resize-none font-mono text-xs'} style={inputStyle} placeholder="One item per line" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className={labelCls + ' mb-2'} style={{ color: 'var(--color-muted)' }}>Line Items</label>
                <div className="space-y-2 mb-2">
                  {editLineItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input value={item.description} onChange={e => {
                        const n = [...editLineItems]; n[idx] = { ...n[idx], description: e.target.value }; setEditLineItems(n)
                      }} placeholder="Description" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                      <input type="number" step="0.01" value={item.amount} onChange={e => {
                        const n = [...editLineItems]; n[idx] = { ...n[idx], amount: e.target.value }; setEditLineItems(n)
                      }} placeholder="Amount" className="w-28 px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                      <button type="button" onClick={() => setEditLineItems(editLineItems.filter((_, i) => i !== idx))}
                        className="p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setEditLineItems([...editLineItems, { description: '', amount: '' }])}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Subtotal (auto)</label>
                  <input value={editSubtotal.toFixed(2)} readOnly className={inputCls + ' bg-gray-50'} style={{ borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Tax</label>
                  <input type="number" step="0.01" value={editData.tax ?? ''} onChange={e => setEditData(p => ({ ...p, tax: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Total (auto)</label>
                  <input value={editTotal.toFixed(2)} readOnly className={inputCls + ' bg-gray-50 font-semibold'} style={{ borderColor: 'var(--color-border)' }} />
                </div>
              </div>

              {/* Terms & Notes */}
              <div className="space-y-3">
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Terms & Conditions</label>
                  <textarea value={editData.terms || ''} onChange={e => setEditData(p => ({ ...p, terms: e.target.value }))}
                    rows={3} className={inputCls + ' resize-none'} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Notes</label>
                  <textarea value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                    rows={2} className={inputCls + ' resize-none'} style={inputStyle} />
                </div>
              </div>

              {saveError && (
                <div className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>{saveError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2 rounded-lg border font-medium text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}>Cancel</button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--color-navy)' }}>
                  <Save className="w-4 h-4" />{isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
