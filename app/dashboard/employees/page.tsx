'use client'

import { useEffect, useState } from 'react'
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

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  job_title: string
  department: string | null
  hire_date: string
  hourly_rate: number | null
  salary: number | null
  employment_type: 'full-time' | 'part-time' | 'contractor'
  status: 'active' | 'inactive' | 'on-leave'
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  emergency_contact: string | null
  emergency_contact_phone: string | null
  created_at: string
  updated_at: string
}

interface FormData {
  first_name: string
  last_name: string
  email: string | null
  phone: string
  job_title: string
  department: string
  hire_date: string
  hourly_rate: string
  salary: string
  employment_type: 'full-time' | 'part-time' | 'contractor'
  status: 'active' | 'inactive' | 'on-leave'
  address: string
  city: string
  state: string
  zip: string
  emergency_contact: string
  emergency_contact_phone: string
}

const initialFormData: FormData = {
  first_name: '',
  last_name: '',
  email: null,
  phone: '',
  job_title: '',
  department: '',
  hire_date: new Date().toISOString().split('T')[0],
  hourly_rate: '',
  salary: '',
  employment_type: 'full-time',
  status: 'active',
  address: '',
  city: '',
  state: '',
  zip: '',
  emergency_contact: '',
  emergency_contact_phone: '',
}

export default function EmployeesPage() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'on-leave'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase()
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      (employee.email?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      employee.job_title.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleOpenForm = (employee?: Employee) => {
    if (employee) {
      setEditingId(employee.id)
      setFormData({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email ?? null,
        phone: employee.phone || '',
        job_title: employee.job_title,
        department: employee.department || '',
        hire_date: employee.hire_date,
        hourly_rate: employee.hourly_rate?.toString() || '',
        salary: employee.salary?.toString() || '',
        employment_type: employee.employment_type,
        status: employee.status,
        address: employee.address || '',
        city: employee.city || '',
        state: employee.state || '',
        zip: employee.zip || '',
        emergency_contact: employee.emergency_contact || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
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
    if (!formData.first_name.trim()) {
      setFormError('First name is required')
      return false
    }
    if (!formData.last_name.trim()) {
      setFormError('Last name is required')
      return false
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormError('Invalid email format')
      return false
    }
    if (!formData.job_title.trim()) {
      setFormError('Job title is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setFormLoading(true)
    try {
      const submitData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        job_title: formData.job_title,
        department: formData.department || null,
        hire_date: formData.hire_date,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        employment_type: formData.employment_type,
        status: formData.status,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip: formData.zip || null,
        emergency_contact: formData.emergency_contact || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase
          .from('employees')
          .update(submitData)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([
            {
              ...submitData,
              created_at: new Date().toISOString(),
            },
          ])

        if (error) throw error
      }

      await fetchEmployees()
      handleCloseForm()
    } catch (error) {
      console.error('Error saving employee:', error)
      setFormError('Failed to save employee. Please try again.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id)

      if (error) throw error

      await fetchEmployees()
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting employee:', error)
    }
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Employees' },
        ]}
      />

      <div className="mt-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>
              Employees
            </h1>
            <p className="text-gray-600 mt-1">
              Manage employee information and employment records
            </p>
          </div>

          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--color-navy)' }}
          >
            <Plus className="w-5 h-5" />
            Add Employee
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
              type="text"
              placeholder="Search by name, email, or job title..."
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
            <option value="on-leave">On Leave</option>
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
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Job Title
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Hire Date
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No employees match your filters'
                      : 'No employees yet. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-t hover:bg-gray-50 transition" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                      {employee.first_name} {employee.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.job_title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.email ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor:
                            employee.status === 'active'
                              ? '#e8f5e9'
                              : employee.status === 'on-leave'
                              ? '#fff3e0'
                              : '#f5f5f5',
                          color:
                            employee.status === 'active'
                              ? '#2e7d32'
                              : employee.status === 'on-leave'
                              ? '#f57c00'
                              : '#666',
                        }}
                      >
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(employee.hire_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleOpenForm(employee)}
                          className="p-2 rounded-lg hover:bg-blue-50 transition"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(employee.id)}
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
          {filteredEmployees.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? 'No employees match your filters'
                : 'No employees yet. Add one to get started.'}
            </div>
          ) : (
            filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-lg border p-6 hover:shadow-lg transition"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-navy)' }}>
                      {employee.first_name} {employee.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">{employee.job_title}</p>
                  </div>
                  <span
                    className="px-2 py-1 rounded text-xs font-semibold"
                    style={{
                      backgroundColor:
                        employee.status === 'active'
                          ? '#e8f5e9'
                          : employee.status === 'on-leave'
                          ? '#fff3e0'
                          : '#f5f5f5',
                      color:
                        employee.status === 'active'
                          ? '#2e7d32'
                          : employee.status === 'on-leave'
                          ? '#f57c00'
                          : '#666',
                    }}
                  >
                    {employee.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <p>
                    <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                      Email:
                    </span>{' '}
                    {employee.email}
                  </p>
                  {employee.phone && (
                    <p>
                      <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                        Phone:
                      </span>{' '}
                      {employee.phone}
                    </p>
                  )}
                  {employee.department && (
                    <p>
                      <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                        Department:
                      </span>{' '}
                      {employee.department}
                    </p>
                  )}
                  <p>
                    <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                      Hired:
                    </span>{' '}
                    {formatDate(employee.hire_date)}
                  </p>
                  {(employee.salary || employee.hourly_rate) && (
                    <p>
                      <span className="font-medium" style={{ color: 'var(--color-navy)' }}>
                        Rate:
                      </span>{' '}
                      {employee.salary
                        ? formatCurrency(employee.salary) + '/year'
                        : formatCurrency(employee.hourly_rate) + '/hour'}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => handleOpenForm(employee)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
                  >
                    <Edit className="w-4 h-4 inline mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(employee.id)}
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
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div
              className="flex items-center justify-between p-6 border-b sticky top-0 bg-white"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-navy)' }}>
                {editingId ? 'Edit Employee' : 'Add New Employee'}
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

              {/* Personal Information */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Personal Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Doe"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
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
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Information */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Employment Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Project Manager"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Department
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Operations"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Hire Date
                    </label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Employment Type
                    </label>
                    <select
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contractor">Contractor</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Compensation */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Compensation
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Annual Salary
                    </label>
                    <input
                      type="number"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="60000"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Hourly Rate
                    </label>
                    <input
                      type="number"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="35"
                      step="0.50"
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
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="City"
                    />
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="State"
                    />
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="ZIP Code"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Emergency Contact
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="(555) 987-6543"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                  Status
                </h3>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on-leave">On Leave</option>
                </select>
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
                      {editingId ? 'Update Employee' : 'Add Employee'}
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
                  Delete Employee
                </h2>
              </div>

              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this employee record? This action cannot be undone.
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
