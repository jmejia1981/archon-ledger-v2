'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'
import { SkeletonTable } from '@/app/components/skeleton-loader'

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
  updated_at: string
}

interface FormData {
  name: string
  company_name: string
  email: string | null
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  contact_person: string
  payment_terms: string
  status: 'active' | 'inactive'
}

const initialFormData: FormData = {
  name: '',
  company_name: '',
  email: null,
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  contact_person: '',
  payment_terms: 'Net 30',
  status: 'active',
}

const supabase = createClient()

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)

    const matchesStatus = statusFilter === 'all' || client.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleOpenForm = (client?: Client) => {
    if (client) {
      setEditingId(client.id)
      setFormData({
        name: client.name,
        company_name: client.company_name || '',
        email: client.email || null,
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        zip: client.zip || '',
        country: client.country || '',
        contact_person: client.contact_person || '',
        payment_terms: client.payment_terms || 'Net 30',
        status: client.status,
      })
    } else {
      setEditingId(null)
      setFormData(initialFormData)
    }
    setFormError('')
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(initialFormData)
    setFormError('')
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setFormError('Client name is required')
      return false
    }
    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormError('Invalid email format')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setFormLoading(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('clients')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([
            {
              ...formData,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])

        if (error) throw error
      }

      await fetchClients()
      handleCloseForm()
    } catch (error) {
      console.error('Error saving client:', error)
      setFormError('Failed to save client. Please try again.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id)

      if (error) throw error

      await fetchClients()
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Clients' },
        ]}
      />

      <div className="mt-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>
              Clients
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your client list and contact information
            </p>
          </div>

          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--color-navy)' }}
          >
            <Plus className="w-5 h-5" />
            Add Client
          </button>
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
              id="clients-search"
              name="search"
              type="text"
              placeholder="Search by name, company, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--color-border)',
              }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {/* Status Filter */}
          <select
            id="clients-status-filter"
            name="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-navy)',
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            className="px-4 py-2 rounded-lg border transition hover:bg-gray-50"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {viewMode === 'table' ? (
              <Eye className="w-5 h-5" style={{ color: 'var(--color-navy)' }} />
            ) : (
              <EyeOff className="w-5 h-5" style={{ color: 'var(--color-navy)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && <SkeletonTable rows={5} />}

      {/* Table View */}
      {!loading && viewMode === 'table' && (
        <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full min-w-[640px]">
            <thead style={{ backgroundColor: 'var(--color-linen)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Client Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Company
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Address
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Status
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No clients match your filters'
                      : 'No clients yet. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-t hover:bg-gray-50 transition cursor-pointer" style={{ borderColor: 'var(--color-border)' }} onDoubleClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                      {client.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.company_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {[client.address, client.city, client.state, client.zip]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: client.status === 'active' ? '#e8f5e9' : '#f5f5f5',
                          color: client.status === 'active' ? '#2e7d32' : '#666',
                        }}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleOpenForm(client)}
                          className="p-2 rounded-lg hover:bg-blue-50 transition"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(client.id)}
                          className="p-2 rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid View */}
      {!loading && viewMode === 'grid' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? 'No clients match your filters'
                : 'No clients yet. Add one to get started.'}
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                className="rounded-lg border p-6 hover:shadow-lg transition cursor-pointer"
                style={{ borderColor: 'var(--color-border)' }}
                onDoubleClick={() => router.push(`/dashboard/clients/${client.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-navy)' }}>
                      {client.name}
                    </h3>
                    {client.company_name && (
                      <p className="text-sm text-gray-600">{client.company_name}</p>
                    )}
                  </div>
                  <span
                    className="px-2 py-1 rounded text-xs font-semibold"
                    style={{
                      backgroundColor: client.status === 'active' ? '#e8f5e9' : '#f5f5f5',
                      color: client.status === 'active' ? '#2e7d32' : '#666',
                    }}
                  >
                    {client.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  {client.email && (
                    <p>
                      <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                        Email:
                      </span>{' '}
                      {client.email}
                    </p>
                  )}
                  {client.phone && (
                    <p>
                      <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                        Phone:
                      </span>{' '}
                      {client.phone}
                    </p>
                  )}
                  {client.city && client.state && (
                    <p>
                      <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                        Location:
                      </span>{' '}
                      {client.city}, {client.state}
                    </p>
                  )}
                  {client.payment_terms && (
                    <p>
                      <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                        Terms:
                      </span>{' '}
                      {client.payment_terms}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => handleOpenForm(client)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
                  >
                    <Edit className="w-4 h-4 inline mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(client.id)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4 inline mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div
              className="flex items-center justify-between p-6 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-navy)' }}>
                {editingId ? 'Edit Client' : 'Add New Client'}
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

              {/* Basic Info */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Basic Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Client / Company Name *
                    </label>
                    <input
                      id="client-name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value, company_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Acme Corp"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Contact Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Email
                    </label>
                    <input
                      id="client-email"
                      name="email"
                      type="email"
                      value={formData.email ?? ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Phone
                    </label>
                    <input
                      id="client-phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Contact Person
                    </label>
                    <input
                      id="client-contact-person"
                      name="contact_person"
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Jane Smith"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Address
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Street Address
                    </label>
                    <input
                      id="client-address"
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      id="client-city"
                      name="city"
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="City"
                    />
                    <input
                      id="client-state"
                      name="state"
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      id="client-zip"
                      name="zip"
                      type="text"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="ZIP Code"
                    />
                    <input
                      id="client-country"
                      name="country"
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              {/* Business Info */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Business Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Payment Terms
                    </label>
                    <input
                      id="client-payment-terms"
                      name="payment_terms"
                      type="text"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Net 30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Status
                    </label>
                    <select
                      id="client-status"
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
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
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {editingId ? 'Update Client' : 'Add Client'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Delete Client
                </h2>
              </div>

              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this client? This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-lg border font-medium transition hover:bg-gray-50"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition hover:opacity-90"
                  style={{ backgroundColor: '#d32f2f' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
