'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Download, Edit2, Save, X } from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'

interface Project {
  id: string
  project_number?: string
  project_name: string
  client_id: string
  contract_budget: number
  description?: string
  status?: string
  created_at?: string
}

interface Client {
  id: string
  name: string
  email: string
  phone: string
  company_name: string
  address?: string
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_amount: number
  amount_paid: number
  status: string
}

interface Expense {
  id: string
  amount: number
  category: string
  created_at: string
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    project_name: '',
    contract_budget: 0,
    description: '',
    status: 'active',
  })

  const supabase = createClient()

  // Load project details
  useEffect(() => {
    const loadProjectDetails = async () => {
      try {
        // Load project
        const { data: projectData } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()

        if (projectData) {
          setProject(projectData)
          setFormData({
            project_name: projectData.project_name,
            contract_budget: projectData.contract_budget,
            description: projectData.description || '',
            status: projectData.status || 'active',
          })

          // Load client
          const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', projectData.client_id)
            .single()

          if (clientData) {
            setClient(clientData)
          }

          // Load invoices for this project
          const { data: invoicesData } = await supabase
            .from('invoices')
            .select('*')
            .eq('project_id', projectId)

          if (invoicesData) {
            setInvoices(invoicesData)
          }

          // Load expenses for this project
          const { data: expensesData } = await supabase
            .from('expenses')
            .select('*')
            .eq('project_id', projectId)

          if (expensesData) {
            setExpenses(expensesData)
          }
        }
      } catch (error) {
        console.error('Error loading project:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProjectDetails()
  }, [projectId, supabase])

  const handleSaveChanges = async () => {
    if (!project) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          project_name: formData.project_name,
          contract_budget: parseFloat(formData.contract_budget.toString()),
          description: formData.description,
          status: formData.status,
        })
        .eq('id', project.id)

      if (error) throw error

      setProject({
        ...project,
        project_name: formData.project_name,
        contract_budget: parseFloat(formData.contract_budget.toString()),
        description: formData.description,
        status: formData.status,
      })

      setEditing(false)
      alert('Project updated successfully!')
    } catch (error) {
      console.error('Error saving project:', error)
      alert('Failed to save project changes')
    } finally {
      setSaving(false)
    }
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

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    'on-hold': 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Projects', href: '/dashboard/projects' }, { label: 'Loading...' }]} />
        <div className="text-center py-12" style={{ color: 'var(--color-muted)' }}>
          Loading project details...
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Projects', href: '/dashboard/projects' }, { label: 'Not Found' }]} />
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <p style={{ color: 'var(--color-muted)' }}>Project not found</p>
        </div>
      </div>
    )
  }

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.invoice_amount, 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const totalProfit = totalInvoiced - totalExpenses

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Projects', href: '/dashboard/projects' }, { label: project.project_name }]} />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>
            {project.project_name}
          </h1>
          <p style={{ color: 'var(--color-muted)' }}>Project management and budget tracking</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:opacity-80 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="col-span-2 space-y-6">
          {/* Project Information */}
          <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
              Project Information
            </h3>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                      Contract Budget
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.contract_budget}
                      onChange={(e) => setFormData({ ...formData, contract_budget: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                    >
                      <option value="active">Active</option>
                      <option value="on-hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition resize-none"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 px-4 py-2 rounded-lg border hover:opacity-80 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
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
            ) : (
              <div className="space-y-4">
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Project Number</p>
                  <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                    {project.project_number || 'N/A'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Status</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${statusColors[project.status || 'active']}`}>
                      {project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('-', ' ') : 'Active'}
                    </span>
                  </div>

                  <div>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Contract Budget</p>
                    <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                      {formatCurrency(project.contract_budget)}
                    </p>
                  </div>
                </div>

                {project.description && (
                  <div>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Description</p>
                    <p style={{ color: 'var(--color-navy)' }} className="mt-1">
                      {project.description}
                    </p>
                  </div>
                )}

                {project.created_at && (
                  <div>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Created</p>
                    <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                      {formatDate(project.created_at)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client Information */}
          {client && (
            <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Client Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Client Name</p>
                  <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                    {client.name}
                  </p>
                </div>
                {client.company_name && (
                  <div>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Company</p>
                    <p style={{ color: 'var(--color-navy)' }}>{client.company_name}</p>
                  </div>
                )}
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Email</p>
                  <p style={{ color: 'var(--color-navy)' }}>{client.email}</p>
                </div>
                {client.phone && (
                  <div>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Phone</p>
                    <p style={{ color: 'var(--color-navy)' }}>{client.phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoices */}
          <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
              Project Invoices ({invoices.length})
            </h3>
            {invoices.length === 0 ? (
              <p style={{ color: 'var(--color-muted)' }}>No invoices for this project yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex justify-between items-center p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--color-linen)' }}
                  >
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                        {inv.invoice_number}
                      </p>
                      <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </p>
                    </div>
                    <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>
                      {formatCurrency(inv.invoice_amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary Cards */}
        <div className="space-y-6">
          {/* Budget Summary */}
          <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
              Budget Summary
            </h3>
            <div className="space-y-3">
              <div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Contract Budget</p>
                <p className="text-lg font-bold" style={{ color: 'var(--color-navy)' }}>
                  {formatCurrency(project.contract_budget)}
                </p>
              </div>

              <div style={{ borderTop: `1px solid var(--color-border)`, paddingTop: '0.75rem' }} className="pt-3">
                <div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Total Invoiced</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>
                    {formatCurrency(totalInvoiced)}
                  </p>
                </div>

                <div className="mt-3">
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Total Paid</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(totalPaid)}
                  </p>
                </div>

                <div className="mt-3">
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Total Expenses</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-destructive)' }}>
                    {formatCurrency(totalExpenses)}
                  </p>
                </div>

                <div style={{ borderTop: `1px solid var(--color-border)`, marginTop: '0.75rem', paddingTop: '0.75rem' }} className="mt-3 pt-3">
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Net Profit</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}
                  >
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Utilization */}
          <div className="bg-white rounded-lg p-6" style={{ border: `1px solid var(--color-border)` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
              Budget Utilization
            </h3>
            <div className="space-y-3">
              <div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Expenses vs Budget</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.min((totalExpenses / project.contract_budget) * 100, 100)}%`,
                      backgroundColor: totalExpenses > project.contract_budget ? 'var(--color-destructive)' : 'var(--color-success)',
                    }}
                  />
                </div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }} className="mt-2">
                  {Math.round((totalExpenses / project.contract_budget) * 100)}% utilized
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
