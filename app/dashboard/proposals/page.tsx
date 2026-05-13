'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Eye, Trash2, FileDown } from 'lucide-react'
import { SkeletonTable } from '@/app/components/skeleton-loader'
import { downloadProposalPDF } from '@/lib/pdf-proposal'

interface Proposal {
  id: string
  proposal_number: string
  client_id: string
  client_name: string
  project_name: string
  project_address?: string
  proposal_date: string
  expiration_date: string
  subtotal?: number
  tax?: number
  total_amount: number
  terms?: string
  notes?: string
  status: string
}

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
}

export default function ProposalsPage() {
  const router = useRouter()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewProposalForm, setShowNewProposalForm] = useState(false)
  const [formData, setFormData] = useState({
    proposal_number: '',
    client_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_contact_person: '',
    client_company_name: '',
    client_street_address: '',
    client_city: '',
    client_state: '',
    client_zip: '',
    client_country: '',
    client_payment_terms: 'Net 30',
    client_status: 'Active',
    project_name: '',
    project_address: '',
    project_city: '',
    project_state: '',
    project_zip: '',
    proposal_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    valid_for: '30 Days from Date Issued',
    scope_of_work: '',
    inclusions: '',
    exclusions: '',
    subtotal: '',
    tax: '',
    terms: '',
    notes: '',
  })
  const [lineItems, setLineItems] = useState([
    { description: '', amount: '' }
  ])

  const supabase = createClient()

  // Auto-calculate subtotal and total from line items
  useEffect(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0
      return sum + amount
    }, 0)

    setFormData(prev => ({
      ...prev,
      subtotal: subtotal.toString(),
      tax: formData.tax, // Keep user's tax input
    }))
  }, [lineItems])

  // Load proposals and clients
  useEffect(() => {
    const loadData = async () => {
      try {
        const [proposalsData, clientsData] = await Promise.all([
          supabase.from('proposals').select('*').order('created_at', { ascending: false }),
          supabase.from('clients').select('id, name'),
        ])

        setProposals(proposalsData.data || [])
        setClients(clientsData.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Filter and search proposals
  useEffect(() => {
    let filtered = proposals

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter((p) =>
        p.proposal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.client_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredProposals(filtered)
  }, [proposals, searchTerm, statusFilter])

  // Generate next proposal number
  const generateNextProposalNumber = () => {
    if (proposals.length === 0) {
      return 'PROP-001'
    }

    const numbers = proposals
      .map((prop) => {
        const match = prop.proposal_number.match(/PROP-(\d+)/)
        return match ? parseInt(match[1]) : 0
      })
      .sort((a, b) => b - a)

    const nextNumber = (numbers[0] || 0) + 1
    return `PROP-${nextNumber.toString().padStart(3, '0')}`
  }

  // Handle open new proposal form
  const handleOpenNewProposalForm = () => {
    const nextNumber = generateNextProposalNumber()
    setFormData({
      proposal_number: nextNumber,
      client_id: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      client_contact_person: '',
      client_company_name: '',
      client_street_address: '',
      client_city: '',
      client_state: '',
      client_zip: '',
      client_country: '',
      client_payment_terms: 'Net 30',
      client_status: 'Active',
      project_name: '',
      project_address: '',
      project_city: '',
      project_state: '',
      project_zip: '',
      proposal_date: new Date().toISOString().split('T')[0],
      expiration_date: '',
      valid_for: '30 Days from Date Issued',
      scope_of_work: '',
      inclusions: '',
      exclusions: '',
      subtotal: '',
      tax: '',
      terms: '',
      notes: '',
    })
    setLineItems([{ description: '', amount: '' }])
    setShowNewProposalForm(true)
  }

  // Handle create proposal
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client_id && !formData.client_name) {
      alert('Client name is required')
      return
    }

    try {
      let clientId = formData.client_id

      // If no client_id, create a new client
      if (!clientId) {
        const { data: newClientData, error: clientError } = await supabase
          .from('clients')
          .insert([
            {
              name: formData.client_name,
              email: formData.client_email || null,
              phone: formData.client_phone || null,
              primary_contact: formData.client_contact_person || null,
              company_name: formData.client_company_name || null,
              address: formData.client_street_address || null,
              city: formData.client_city || null,
              state: formData.client_state || null,
              zip: formData.client_zip || null,
              client_type: formData.client_payment_terms || 'Standard',
              status: formData.client_status || 'Active',
              notes: null,
            },
          ])
          .select()

        if (clientError) {
          console.error('Error creating client:', clientError)
          throw clientError
        }

        if (newClientData && newClientData[0]) {
          clientId = newClientData[0].id
          // Add new client to the list
          setClients([...clients, newClientData[0]])
        }
      }

      const subtotal = parseFloat(formData.subtotal) || 0
      const tax = parseFloat(formData.tax) || 0
      const totalAmount = subtotal + tax

      const proposalData = {
        proposal_number: formData.proposal_number,
        client_id: clientId || null,
        client_name: formData.client_name,
        client_email: formData.client_email || null,
        project_name: formData.project_name || '',
        project_address: formData.project_address || '',
        project_city: formData.project_city || '',
        project_state: formData.project_state || '',
        project_zip: formData.project_zip || '',
        proposal_date: formData.proposal_date,
        expiration_date: formData.expiration_date || null,
        valid_for: formData.valid_for || '30 Days from Date Issued',
        scope_of_work: formData.scope_of_work || '',
        inclusions: formData.inclusions || '',
        exclusions: formData.exclusions || '',
        subtotal: subtotal,
        tax: tax,
        total_amount: totalAmount,
        terms: formData.terms || '',
        notes: formData.notes || '',
        status: 'draft',
      }

      console.log('Inserting proposal:', proposalData)

      const { data, error, status, statusText } = await supabase
        .from('proposals')
        .insert([proposalData])
        .select()

      console.log('Insert response:', { data, error, status, statusText })

      if (error) {
        console.error('Supabase error details:', {
          error,
          status,
          statusText,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
        })
        throw new Error(`Supabase insert failed: ${JSON.stringify(error)}`)
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from insert')
      }

      if (data && data[0]) {
        // Add line items if provided
        if (lineItems.some(item => item.description)) {
          const itemsToInsert = lineItems
            .filter(item => item.description)
            .map(item => ({
              proposal_id: data[0].id,
              description: item.description,
              quantity: 1,
              unit_price: parseFloat(item.amount.toString()) || 0,
              amount: parseFloat(item.amount.toString()) || 0,
            }))

          try {
            console.log('Inserting line items:', itemsToInsert)
            await supabase
              .from('proposal_items')
              .insert(itemsToInsert)
          } catch (e) {
            console.error('Line items error:', e)
          }
        }

        setProposals([...proposals, ...data])
        setShowNewProposalForm(false)
        alert('Proposal created successfully!')
      }
    } catch (error) {
      console.error('Error creating proposal:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create proposal'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Handle delete proposal
  const handleDeleteProposal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this proposal?')) return

    try {
      await supabase.from('proposals').delete().eq('id', id)
      setProposals(proposals.filter((p) => p.id !== id))
    } catch (error) {
      console.error('Error deleting proposal:', error)
    }
  }

  // Handle download proposal PDF
  const handleDownloadProposalPDF = async (proposal: Proposal) => {
    try {
      // Get full proposal data including city, state, zip, scope, inclusions, exclusions
      const { data: fullProposal } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposal.id)
        .single()

      // Get line items for this proposal
      const { data: itemsData } = await supabase
        .from('proposal_items')
        .select('*')
        .eq('proposal_id', proposal.id)

      const items = itemsData || []

      // Parse scope, inclusions, exclusions from newline-separated text
      const scopeOfWork = (fullProposal?.scope_of_work || '')
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s)
      const inclusions = (fullProposal?.inclusions || '')
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s)
      const exclusions = (fullProposal?.exclusions || '')
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s)

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

      // Fetch company settings
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

      // Fetch client details
      let clientCompany = ''
      let clientPhone = ''
      if (proposal.client_id) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('company_name, phone, email')
          .eq('id', proposal.client_id)
          .single()
        if (clientError) {
          console.error('client fetch error:', clientError)
        } else if (clientData) {
          clientCompany = (clientData as any).company_name || ''
          clientPhone = (clientData as any).phone || ''
        }
      }

      downloadProposalPDF({
        proposalNumber: proposal.proposal_number,
        proposalDate: proposal.proposal_date,
        expirationDate: proposal.expiration_date,
        clientName: proposal.client_name,
        clientCompany,
        clientEmail: fullProposal?.client_email || '',
        clientPhone,
        projectName: proposal.project_name,
        projectAddress: proposal.project_address,
        projectCity: fullProposal?.project_city || '',
        projectState: fullProposal?.project_state || '',
        projectZip: fullProposal?.project_zip || '',
        companyName,
        companyEmail,
        companyPhone,
        companyAddress,
        companyCity,
        companyState,
        companyZip,
        logoImage: logoImage,
        lineItems: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          amount: item.amount,
        })),
        subtotal: proposal.subtotal || 0,
        tax: proposal.tax || 0,
        totalAmount: proposal.total_amount,
        terms: proposal.terms,
        notes: proposal.notes,
        scopeOfWork: scopeOfWork,
        inclusions: inclusions,
        exclusions: exclusions,
        validFor: fullProposal?.valid_for || '30 Days from Date Issued',
      }, `${proposal.proposal_number}.pdf`)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to download PDF')
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* New Proposal Form Modal */}
      {showNewProposalForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-navy)' }}>Create New Proposal</h2>
            <form onSubmit={handleCreateProposal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Proposal Number
                  </label>
                  <input
                    type="text"
                    id="proposals-proposal_number"
                    name="proposal_number"
                    value={formData.proposal_number}
                    readOnly
                    className="w-full px-4 py-2 rounded-lg border bg-gray-50"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Proposal Date
                  </label>
                  <input
                    type="date"
                    id="proposals-proposal_date"
                    name="proposal_date"
                    value={formData.proposal_date}
                    onChange={(e) => setFormData({ ...formData, proposal_date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              {/* Client Information */}
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-navy)' }}>CLIENT INFORMATION</h3>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Select Existing Client or Create New
                </label>
                <select
                  id="proposals-client_id"
                  name="client_id"
                  value={formData.client_id}
                  onChange={(e) => {
                    const selectedId = e.target.value
                    if (selectedId === 'new') {
                      // Create new client
                      setFormData({ ...formData, client_id: '', client_name: '' })
                    } else if (selectedId) {
                      // Load existing client data
                      const selectedClient = clients.find((c) => c.id === selectedId)
                      if (selectedClient) {
                        setFormData({
                          ...formData,
                          client_id: selectedId,
                          client_name: selectedClient.name,
                          client_email: selectedClient.email || '',
                          client_phone: selectedClient.phone || '',
                          client_contact_person: (selectedClient as any).primary_contact || '',
                          client_company_name: (selectedClient as any).company_name || '',
                          client_street_address: (selectedClient as any).address || '',
                          client_city: (selectedClient as any).city || '',
                          client_state: (selectedClient as any).state || '',
                          client_zip: (selectedClient as any).zip || '',
                          client_country: '',
                          client_payment_terms: (selectedClient as any).client_type || 'Standard',
                          client_status: (selectedClient as any).status || 'Active',
                        })
                      }
                    } else {
                      setFormData({
                        ...formData,
                        client_id: '',
                        client_name: '',
                        client_email: '',
                        client_phone: '',
                        client_contact_person: '',
                        client_company_name: '',
                        client_street_address: '',
                        client_city: '',
                        client_state: '',
                        client_zip: '',
                        client_country: '',
                      })
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="">-- Create New Client --</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Client Name *
                  </label>
                  <input
                    type="text"
                    id="proposals-client_name"
                    name="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="proposals-client_company_name"
                    name="client_company_name"
                    value={formData.client_company_name}
                    onChange={(e) => setFormData({ ...formData, client_company_name: e.target.value })}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="proposals-client_email"
                    name="client_email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    placeholder="john@example.com"
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
                    id="proposals-client_phone"
                    name="client_phone"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Contact Person
                </label>
                <input
                  type="text"
                  id="proposals-client_contact_person"
                  name="client_contact_person"
                  value={formData.client_contact_person}
                  onChange={(e) => setFormData({ ...formData, client_contact_person: e.target.value })}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Street Address
                </label>
                <input
                  type="text"
                  id="proposals-client_street_address"
                  name="client_street_address"
                  value={formData.client_street_address}
                  onChange={(e) => setFormData({ ...formData, client_street_address: e.target.value })}
                  placeholder="123 Main St"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    City
                  </label>
                  <input
                    type="text"
                    id="proposals-client_city"
                    name="client_city"
                    value={formData.client_city}
                    onChange={(e) => setFormData({ ...formData, client_city: e.target.value })}
                    placeholder="New York"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    State
                  </label>
                  <input
                    type="text"
                    id="proposals-client_state"
                    name="client_state"
                    value={formData.client_state}
                    onChange={(e) => setFormData({ ...formData, client_state: e.target.value })}
                    placeholder="NY"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="proposals-client_zip"
                    name="client_zip"
                    value={formData.client_zip}
                    onChange={(e) => setFormData({ ...formData, client_zip: e.target.value })}
                    placeholder="10001"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Country
                </label>
                <input
                  type="text"
                  id="proposals-client_country"
                  name="client_country"
                  value={formData.client_country}
                  onChange={(e) => setFormData({ ...formData, client_country: e.target.value })}
                  placeholder="USA"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    id="proposals-client_payment_terms"
                    name="client_payment_terms"
                    value={formData.client_payment_terms}
                    onChange={(e) => setFormData({ ...formData, client_payment_terms: e.target.value })}
                    placeholder="Net 30"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Status
                  </label>
                  <select
                    id="proposals-client_status"
                    name="client_status"
                    value={formData.client_status}
                    onChange={(e) => setFormData({ ...formData, client_status: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Project Information */}
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-navy)' }}>PROJECT INFORMATION</h3>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Project Name
                </label>
                <input
                  type="text"
                  id="proposals-project_name"
                  name="project_name"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="Enter project name"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Project Address
                </label>
                <input
                  type="text"
                  id="proposals-project_address"
                  name="project_address"
                  value={formData.project_address}
                  onChange={(e) => setFormData({ ...formData, project_address: e.target.value })}
                  placeholder="Enter project address"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    City
                  </label>
                  <input
                    type="text"
                    id="proposals-project_city"
                    name="project_city"
                    value={formData.project_city}
                    onChange={(e) => setFormData({ ...formData, project_city: e.target.value })}
                    placeholder="New York"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    State
                  </label>
                  <input
                    type="text"
                    id="proposals-project_state"
                    name="project_state"
                    value={formData.project_state}
                    onChange={(e) => setFormData({ ...formData, project_state: e.target.value })}
                    placeholder="NY"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="proposals-project_zip"
                    name="project_zip"
                    value={formData.project_zip}
                    onChange={(e) => setFormData({ ...formData, project_zip: e.target.value })}
                    placeholder="10001"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    id="proposals-expiration_date"
                    name="expiration_date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Valid For
                  </label>
                  <input
                    type="text"
                    id="proposals-valid_for"
                    name="valid_for"
                    value={formData.valid_for}
                    onChange={(e) => setFormData({ ...formData, valid_for: e.target.value })}
                    placeholder="30 Days from Date Issued"
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Scope of Work
                </label>
                <textarea
                  id="proposals-scope_of_work"
                  name="scope_of_work"
                  value={formData.scope_of_work}
                  onChange={(e) => setFormData({ ...formData, scope_of_work: e.target.value })}
                  placeholder="Enter scope items, one per line&#10;Example:&#10;1st Floor Bathroom renovation — 72 SF&#10;2nd Floor Bathroom renovation — 72 SF"
                  className="w-full px-4 py-2 rounded-lg border font-mono text-xs"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Inclusions
                </label>
                <textarea
                  id="proposals-inclusions"
                  name="inclusions"
                  value={formData.inclusions}
                  onChange={(e) => setFormData({ ...formData, inclusions: e.target.value })}
                  placeholder="Enter inclusion items, one per line&#10;Example:&#10;Demolition of existing bathroom finishes and vanity&#10;Supply and install porcelain tile on floors"
                  className="w-full px-4 py-2 rounded-lg border font-mono text-xs"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Exclusions
                </label>
                <textarea
                  id="proposals-exclusions"
                  name="exclusions"
                  value={formData.exclusions}
                  onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })}
                  placeholder="Enter exclusion items, one per line&#10;Example:&#10;Bathtub replacement&#10;Light fixture replacement"
                  className="w-full px-4 py-2 rounded-lg border font-mono text-xs"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-muted)' }}>
                  Line Items
                </label>
                <div className="space-y-3 mb-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        id={`proposals-line_description-${index}`}
                        name={`line_description-${index}`}
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...lineItems]
                          newItems[index].description = e.target.value
                          setLineItems(newItems)
                        }}
                        placeholder="Item description"
                        className="col-span-8 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                      <input
                        type="number"
                        id={`proposals-line_amount-${index}`}
                        name={`line_amount-${index}`}
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => {
                          const newItems = [...lineItems]
                          newItems[index].amount = e.target.value
                          setLineItems(newItems)
                        }}
                        placeholder="Amount"
                        className="col-span-2 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                      <button
                        type="button"
                        onClick={() => setLineItems(lineItems.filter((_, i) => i !== index))}
                        className="col-span-2 px-2 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        Remove
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Subtotal (Auto)
                  </label>
                  <input
                    type="number"
                    id="proposals-subtotal"
                    name="subtotal"
                    step="0.01"
                    value={formData.subtotal}
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
                    id="proposals-tax"
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
                    id="proposals-total"
                    name="total"
                    step="0.01"
                    value={(parseFloat(formData.subtotal) || 0) + (parseFloat(formData.tax) || 0)}
                    readOnly
                    className="w-full px-4 py-2 rounded-lg border bg-gray-50 font-semibold"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Terms & Conditions
                </label>
                <textarea
                  id="proposals-terms"
                  name="terms"
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  placeholder="Enter proposal terms..."
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                  Notes
                </label>
                <textarea
                  id="proposals-notes"
                  name="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional notes..."
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewProposalForm(false)}
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
                  Create Proposal
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
            id="proposals-search"
            name="search"
            placeholder="Search proposals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
          />
        </div>

        <select
          id="proposals-statusFilter"
          name="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border appearance-none pr-10"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>

        <button
          onClick={handleOpenNewProposalForm}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <Plus className="w-4 h-4" />
          New Proposal
        </button>
      </div>

      {/* Proposals Table */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonTable rows={5} />
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <p style={{ color: 'var(--color-muted)' }}>No proposals found. Create your first proposal to get started!</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-x-auto" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <table className="w-full min-w-[640px]">
            <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Proposal #</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Client</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Project</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Expires</th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProposals.map((proposal) => (
                <tr
                  key={proposal.id}
                  style={{ borderBottom: `1px solid var(--color-border)` }}
                  className="hover:opacity-75 cursor-pointer"
                  onDoubleClick={() => router.push(`/dashboard/proposals/${proposal.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{proposal.proposal_number}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{proposal.client_name}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{proposal.project_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(proposal.proposal_date)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{proposal.expiration_date ? formatDate(proposal.expiration_date) : 'N/A'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(proposal.total_amount)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[proposal.status]}`}>
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)}
                      style={{ color: 'var(--color-navy)' }}
                      className="hover:opacity-80 transition"
                      title="View proposal"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadProposalPDF(proposal)}
                      style={{ color: 'var(--color-secondary)' }}
                      className="hover:opacity-80 transition"
                      title="Download as PDF"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProposal(proposal.id)}
                      className="hover:opacity-80 transition"
                      style={{ color: 'var(--color-destructive)' }}
                      title="Delete proposal"
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
