'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit2, Save, X, ArrowLeft } from 'lucide-react'

interface Project {
  id: string
  project_number?: string
  project_name: string
  client_id: string
  contract_budget: number
  description?: string
  status?: string
  project_address?: string
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
  description?: string
  created_at: string
}

interface VendorBill {
  id: string
  vendor: string
  amount: number
  description?: string
  tax_category?: string
  created_at: string
}

interface LaborEntry {
  id: string
  employee_id: string
  regular_hours: number
  overtime_hours: number
  work_date?: string
}

interface MileageEntry {
  id: string
  employee_id: string
  date: string
  starting_location?: string
  destination?: string
  miles_driven: number
  reimbursement_rate: number
}

interface Employee {
  id: string
  first_name?: string
  last_name?: string
  hourly_rate: number | null
}

const supabase = createClient()

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [bills, setBills] = useState<VendorBill[]>([])
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>([])
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    project_name: '',
    contract_budget: 0,
    description: '',
    status: 'active',
  })

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch everything in parallel
        const [
          projectRes,
          invoicesRes,
          expensesRes,
          billsRes,
          laborRes,
          mileageRes,
          employeesRes,
        ] = await Promise.all([
          supabase.from('projects').select('*').eq('id', projectId).single(),
          supabase.from('invoices').select('id, invoice_number, invoice_amount, amount_paid, status').eq('project_id', projectId),
          supabase.from('expenses').select('id, amount, category, description, created_at').eq('project_id', projectId),
          supabase.from('vendor_bills').select('id, vendor, amount, description, tax_category, created_at').eq('project_id', projectId),
          supabase.from('labor_entries').select('id, employee_id, regular_hours, overtime_hours, work_date').eq('project_id', projectId),
          supabase.from('mileage_entries').select('id, employee_id, date, starting_location, destination, miles_driven, reimbursement_rate').eq('project_id', projectId).order('date', { ascending: false }),
          supabase.from('employees').select('id, first_name, last_name, hourly_rate'),
        ])

        if (projectRes.error) throw new Error(projectRes.error.message)
        if (!projectRes.data) throw new Error('Project not found')

        setProject(projectRes.data)
        setFormData({
          project_name: projectRes.data.project_name,
          contract_budget: projectRes.data.contract_budget,
          description: projectRes.data.description || '',
          status: projectRes.data.status || 'active',
        })

        setInvoices(invoicesRes.data || [])
        setExpenses(expensesRes.data || [])
        setBills(billsRes.data || [])
        setLaborEntries(laborRes.data || [])
        setMileageEntries(mileageRes.data || [])
        setEmployees(employeesRes.data || [])

        // Load client separately (needs project.client_id)
        if (projectRes.data.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', projectRes.data.client_id)
            .single()
          if (clientData) setClient(clientData)
        }
      } catch (err: any) {
        console.error('Error loading project:', err)
        setLoadError(err?.message || 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    if (projectId) load()
  }, [projectId])

  const handleSaveChanges = async () => {
    if (!project) return
    setSaving(true)
    setSaveError(null)
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
      setProject({ ...project, ...formData, contract_budget: parseFloat(formData.contract_budget.toString()) })
      setEditing(false)
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const fmtFull = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
  const fmtDate = (d: string) =>
    new Date(d + (d.includes('T') ? '' : 'T00:00:00'))
      .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    'on-hold': 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12" style={{ color: 'var(--color-muted)' }}>Loading project details...</div>
      </div>
    )
  }

  if (loadError || !project) {
    return (
      <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: '1px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-muted)' }}>{loadError || 'Project not found'}</p>
        <button onClick={() => router.push('/dashboard/projects')} className="mt-4 px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--color-navy)' }}>
          Back to Projects
        </button>
      </div>
    )
  }

  // ── Calculations ──────────────────────────────────────────────
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.invoice_amount || 0), 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
  const totalBills = bills.reduce((sum, b) => sum + (b.amount || 0), 0)
  const totalLaborCost = laborEntries.reduce((sum, entry) => {
    const emp = employees.find((e) => e.id === entry.employee_id)
    const rate = emp?.hourly_rate || 0
    return sum + (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5
  }, 0)
  const totalLaborHours = laborEntries.reduce((sum, e) => sum + (e.regular_hours || 0) + (e.overtime_hours || 0), 0)
  const totalMileageCost = mileageEntries.reduce((sum, m) => sum + (m.miles_driven || 0) * (m.reimbursement_rate || 0), 0)
  const totalMilesMiles = mileageEntries.reduce((sum, m) => sum + (m.miles_driven || 0), 0)
  const totalCosts = totalExpenses + totalBills + totalLaborCost + totalMileageCost
  const totalProfit = totalInvoiced - totalCosts
  const budget = project.contract_budget || 0
  const budgetUsedPct = budget > 0 ? Math.min((totalCosts / budget) * 100, 100) : 0
  const invoicedPct = budget > 0 ? Math.min((totalInvoiced / budget) * 100, 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/dashboard/projects')} className="p-2 hover:opacity-80 flex-shrink-0 mt-1" style={{ color: 'var(--color-navy)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>Project #{project.project_number}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[project.status || 'active']}`}>
              {(project.status || 'active').charAt(0).toUpperCase() + (project.status || 'active').slice(1).replace('-', ' ')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{project.project_name}</h1>
          {project.project_address && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>{project.project_address}</p>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:opacity-80 transition flex-shrink-0"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}>
            <Edit2 className="w-4 h-4" /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Project Info / Edit form */}
          <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>Project Information</h3>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Project Name</label>
                  <input type="text" value={formData.project_name} onChange={e => setFormData({ ...formData, project_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none" style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Contract Budget</label>
                    <input type="number" step="0.01" value={formData.contract_budget}
                      onChange={e => setFormData({ ...formData, contract_budget: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border focus:outline-none" style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Status</label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border focus:outline-none" style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}>
                      <option value="active">Active</option>
                      <option value="on-hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={3} className="w-full px-4 py-2 rounded-lg border focus:outline-none resize-none"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }} />
                </div>
                {saveError && (
                  <div className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>{saveError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditing(false)}
                    className="flex-1 px-4 py-2 rounded-lg border hover:opacity-80 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}>
                    <X className="w-4 h-4 inline mr-1" />Cancel
                  </button>
                  <button onClick={handleSaveChanges} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-navy)' }}>
                    <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Project Number</p>
                  <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{project.project_number || '—'}</p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Contract Budget</p>
                  <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{fmtFull(budget)}</p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${statusColors[project.status || 'active']}`}>
                    {(project.status || 'active').charAt(0).toUpperCase() + (project.status || 'active').slice(1).replace('-', ' ')}
                  </span>
                </div>
                {project.created_at && (
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Created</p>
                    <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{fmtDate(project.created_at)}</p>
                  </div>
                )}
                {project.description && (
                  <div className="col-span-2">
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Description</p>
                    <p style={{ color: 'var(--color-navy)' }}>{project.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client */}
          {client && (
            <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>Client</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p style={{ color: 'var(--color-muted)' }}>Name</p>
                  <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{client.name}</p>
                </div>
                {client.company_name && (
                  <div>
                    <p style={{ color: 'var(--color-muted)' }}>Company</p>
                    <p style={{ color: 'var(--color-navy)' }}>{client.company_name}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <p style={{ color: 'var(--color-muted)' }}>Email</p>
                    <p style={{ color: 'var(--color-navy)' }}>{client.email}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <p style={{ color: 'var(--color-muted)' }}>Phone</p>
                    <p style={{ color: 'var(--color-navy)' }}>{client.phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoices */}
          <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
              Invoices ({invoices.length})
            </h3>
            {invoices.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No invoices for this project yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{inv.invoice_number}</p>
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)} · Paid: {fmtFull(inv.amount_paid)}
                      </p>
                    </div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{fmtFull(inv.invoice_amount)}</p>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-semibold text-sm" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                  <span>Total Invoiced</span>
                  <span>{fmtFull(totalInvoiced)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Vendor Bills */}
          <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-navy)' }}>
              Vendor Bills ({bills.length})
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-muted)' }}>
              Bills linked to this project. Add new bills in Payables → select this project.
            </p>
            {bills.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No vendor bills linked to this project yet</p>
            ) : (
              <div className="space-y-2">
                {bills.map(bill => (
                  <div key={bill.id} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{bill.vendor}</p>
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        {bill.description || '—'} {bill.tax_category && `· ${bill.tax_category}`}
                      </p>
                    </div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{fmtFull(bill.amount)}</p>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-semibold text-sm" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                  <span>Total Bills</span>
                  <span>{fmtFull(totalBills)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Labor */}
          {laborEntries.length > 0 && (
            <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Labor ({totalLaborHours.toFixed(1)} hrs)
              </h3>
              <div className="space-y-2">
                {laborEntries.map(entry => {
                  const emp = employees.find(e => e.id === entry.employee_id)
                  const rate = emp?.hourly_rate || 0
                  const cost = (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5
                  return (
                    <div key={entry.id} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>
                          {emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Unknown'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                          {entry.regular_hours}h reg{entry.overtime_hours > 0 ? ` · ${entry.overtime_hours}h OT` : ''} @ ${rate}/hr
                          {entry.work_date ? ` · ${fmtDate(entry.work_date)}` : ''}
                        </p>
                      </div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{fmtFull(cost)}</p>
                    </div>
                  )
                })}
                <div className="flex justify-between pt-2 font-semibold text-sm" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                  <span>Total Labor Cost</span>
                  <span>{fmtFull(totalLaborCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Mileage */}
          {mileageEntries.length > 0 && (
            <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Mileage ({totalMilesMiles.toFixed(0)} mi · {fmtFull(totalMileageCost)})
              </h3>
              <div className="space-y-2">
                {mileageEntries.map(entry => {
                  const emp = employees.find(e => e.id === entry.employee_id)
                  const cost = (entry.miles_driven || 0) * (entry.reimbursement_rate || 0)
                  return (
                    <div key={entry.id} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>
                          {emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Unknown'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                          {entry.miles_driven} mi @ ${entry.reimbursement_rate}/mi
                          {entry.destination ? ` → ${entry.destination}` : ''}
                          {entry.date ? ` · ${fmtDate(entry.date)}` : ''}
                        </p>
                      </div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{fmtFull(cost)}</p>
                    </div>
                  )
                })}
                <div className="flex justify-between pt-2 font-semibold text-sm" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                  <span>Total Mileage</span>
                  <span>{fmtFull(totalMileageCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Expenses (project-linked overhead) */}
          {expenses.length > 0 && (
            <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Direct Expenses ({expenses.length})
              </h3>
              <div className="space-y-2">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{exp.description || exp.category}</p>
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{exp.category}</p>
                    </div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{fmtFull(exp.amount)}</p>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-semibold text-sm" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                  <span>Total Expenses</span>
                  <span>{fmtFull(totalExpenses)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Budget Summary ──────────────────── */}
        <div className="space-y-6">
          {/* Budget Summary */}
          <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>Budget Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-muted)' }}>Contract Budget</span>
                <span className="text-base font-bold" style={{ color: 'var(--color-navy)' }}>{fmtFull(budget)}</span>
              </div>

              {/* Revenue */}
              <p className="text-xs font-bold uppercase tracking-wide pt-1" style={{ color: 'var(--color-navy)' }}>Revenue</p>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--color-muted)' }}>Total Invoiced</span>
                <span className="font-semibold" style={{ color: '#16a34a' }}>{fmtFull(totalInvoiced)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--color-muted)' }}>Total Collected</span>
                <span className="font-semibold" style={{ color: 'var(--color-navy)' }}>{fmtFull(totalPaid)}</span>
              </div>
              {budget > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted)' }}>Remaining to Bill</span>
                  <span className="font-semibold" style={{ color: budget - totalInvoiced >= 0 ? '#2563eb' : '#dc2626' }}>
                    {fmtFull(budget - totalInvoiced)}
                  </span>
                </div>
              )}

              {/* Costs */}
              <p className="text-xs font-bold uppercase tracking-wide pt-2" style={{ color: 'var(--color-navy)', borderTop: '1px solid var(--color-border)' }}>
                <span className="block pt-2">Costs</span>
              </p>
              {totalBills > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted)' }}>Vendor Bills</span>
                  <span className="font-semibold" style={{ color: '#dc2626' }}>{fmtFull(totalBills)}</span>
                </div>
              )}
              {totalLaborCost > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted)' }}>Labor ({totalLaborHours.toFixed(1)} hrs)</span>
                  <span className="font-semibold" style={{ color: '#dc2626' }}>{fmtFull(totalLaborCost)}</span>
                </div>
              )}
              {totalMileageCost > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted)' }}>Mileage ({totalMilesMiles.toFixed(0)} mi)</span>
                  <span className="font-semibold" style={{ color: '#dc2626' }}>{fmtFull(totalMileageCost)}</span>
                </div>
              )}
              {totalExpenses > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted)' }}>Direct Expenses</span>
                  <span className="font-semibold" style={{ color: '#dc2626' }}>{fmtFull(totalExpenses)}</span>
                </div>
              )}
              {totalBills === 0 && totalLaborCost === 0 && totalMileageCost === 0 && totalExpenses === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>No costs recorded yet</p>
              )}

              {/* Total Costs */}
              <div className="flex justify-between items-center pt-2 pb-2 font-bold" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-navy)' }}>
                <span>Total Costs</span>
                <span style={{ color: '#dc2626' }}>{fmtFull(totalCosts)}</span>
              </div>

              {/* Net Profit */}
              <div className="flex justify-between items-center pt-2 font-bold text-base" style={{ borderTop: '2px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-navy)' }}>Net Profit</span>
                <span style={{ color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>{fmtFull(totalProfit)}</span>
              </div>
            </div>
          </div>

          {/* Budget Utilization */}
          <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--color-border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>Budget Utilization</h3>
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ color: 'var(--color-muted)' }}>Costs vs Budget</span>
                  <span className="font-semibold" style={{ color: 'var(--color-navy)' }}>{budgetUsedPct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{
                    width: `${budgetUsedPct}%`,
                    backgroundColor: budgetUsedPct > 100 ? '#dc2626' : budgetUsedPct > 80 ? '#f59e0b' : '#16a34a',
                  }} />
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {fmtFull(totalCosts)} of {fmtFull(budget)}
                </p>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ color: 'var(--color-muted)' }}>Invoiced vs Budget</span>
                  <span className="font-semibold" style={{ color: 'var(--color-navy)' }}>{invoicedPct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{
                    width: `${invoicedPct}%`,
                    backgroundColor: '#2563eb',
                  }} />
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {fmtFull(totalInvoiced)} of {fmtFull(budget)}
                </p>
              </div>

              {budget > 0 && (
                <div className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <p style={{ color: 'var(--color-muted)' }}>Gross Margin</p>
                  <p className="text-lg font-bold" style={{ color: totalInvoiced > 0 ? (totalProfit >= 0 ? '#16a34a' : '#dc2626') : 'var(--color-muted)' }}>
                    {totalInvoiced > 0 ? `${((totalProfit / totalInvoiced) * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
