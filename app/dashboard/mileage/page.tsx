'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Trash2, Navigation, X } from 'lucide-react'

interface MileageEntry {
  id: string
  employee_id: string
  project_id: string
  date: string
  starting_location: string
  destination: string
  miles_driven: number
  reimbursement_rate: number
  notes: string
}

interface Employee {
  id: string
  name: string
}

interface Project {
  id: string
  project_name: string
}

const supabase = createClient()

export default function MileagePage() {
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<MileageEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewMileageForm, setShowNewMileageForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [formData, setFormData] = useState({
    employee_id: '',
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    starting_location: '',
    destination: '',
    miles_driven: '',
    reimbursement_rate: '0.65',
    notes: '',
  })

  // Load mileage entries, employees, and projects
  useEffect(() => {
    const loadData = async () => {
      try {
        const [mileageData, employeesData, projectsData] = await Promise.all([
          supabase.from('mileage_entries').select('*'),
          supabase.from('employees').select('id, name, first_name, last_name'),
          supabase.from('projects').select('id, project_name'),
        ])

        // Map employees to handle both old (name) and new (first_name + last_name) formats
        const formattedEmployees = (employeesData.data || []).map((emp: any) => ({
          id: emp.id,
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        }))

        setMileageEntries(mileageData.data || [])
        setEmployees(formattedEmployees)
        setProjects(projectsData.data || [])
      } catch (error) {
        console.log('Error loading data - tables may not exist yet')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter and search mileage entries
  useEffect(() => {
    let filtered = mileageEntries

    if (searchTerm) {
      filtered = filtered.filter(
        (entry) =>
          entry.starting_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredEntries(filtered)
  }, [mileageEntries, searchTerm])

  // Handle create mileage entry
  const handleCreateMileageEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employee_id || !formData.miles_driven) {
      alert('Employee and miles driven are required')
      return
    }

    try {
      console.log('Creating mileage entry:', formData)
      const { data, error } = await supabase
        .from('mileage_entries')
        .insert([
          {
            employee_id: formData.employee_id,
            project_id: formData.project_id || null,
            date: formData.date,
            starting_location: formData.starting_location,
            destination: formData.destination,
            miles_driven: parseFloat(formData.miles_driven),
            reimbursement_rate: parseFloat(formData.reimbursement_rate) || 0.65,
            notes: formData.notes,
          },
        ])
        .select()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`Failed to create: ${error.message}`)
      }

      console.log('Mileage entry created successfully:', data)
      if (data) {
        setMileageEntries([...mileageEntries, ...data])
        setFormData({
          employee_id: '',
          project_id: '',
          date: new Date().toISOString().split('T')[0],
          starting_location: '',
          destination: '',
          miles_driven: '',
          reimbursement_rate: '0.65',
          notes: '',
        })
        setShowNewMileageForm(false)
        alert('Mileage entry created successfully!')
      }
    } catch (error) {
      console.error('Error creating mileage entry:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create mileage entry'}`)
    }
  }

  // Handle delete mileage entry
  const handleDeleteMileageEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mileage entry?')) return

    try {
      await supabase.from('mileage_entries').delete().eq('id', id)
      setMileageEntries(mileageEntries.filter((e) => e.id !== id))
    } catch (error) {
      console.error('Error deleting mileage entry:', error)
    }
  }

  // Handle edit (double-click)
  const handleEditMileageEntry = (entry: MileageEntry) => {
    setEditingId(entry.id)
    setEditFormData({
      employee_id: entry.employee_id,
      project_id: entry.project_id,
      date: entry.date,
      starting_location: entry.starting_location,
      destination: entry.destination,
      miles_driven: entry.miles_driven.toString(),
      reimbursement_rate: entry.reimbursement_rate.toString(),
      notes: entry.notes,
    })
    setShowEditModal(true)
  }

  const handleSaveEditedEntry = async () => {
    if (!editingId || !editFormData) return

    try {
      const updateData = {
        employee_id: editFormData.employee_id,
        project_id: editFormData.project_id || null,
        date: editFormData.date,
        starting_location: editFormData.starting_location,
        destination: editFormData.destination,
        miles_driven: parseFloat(editFormData.miles_driven) || 0,
        reimbursement_rate: parseFloat(editFormData.reimbursement_rate) || 0.65,
        notes: editFormData.notes,
      }

      const { error } = await supabase.from('mileage_entries').update(updateData).eq('id', editingId)
      if (error) throw error

      setMileageEntries(mileageEntries.map((e) => e.id === editingId ? { ...e, ...updateData } : e))
      setEditingId(null)
      setEditFormData(null)
      setShowEditModal(false)
    } catch (error) {
      console.error('Error updating mileage entry:', error)
      alert('Failed to update mileage entry')
    }
  }

  const getEmployeeName = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.name || 'Unknown'
  }

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.project_name || 'N/A'
  }

  const calculateReimbursement = (entry: MileageEntry) => {
    return entry.miles_driven * entry.reimbursement_rate
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const totalMiles = filteredEntries.reduce((sum, e) => sum + e.miles_driven, 0)
  const totalReimbursement = filteredEntries.reduce((sum, e) => sum + calculateReimbursement(e), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Mileage</h1>
          <p style={{ color: 'var(--color-muted)' }}>Track employee travel and reimbursements</p>
        </div>
        <button
          onClick={() => setShowNewMileageForm(true)}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <Plus className="w-5 h-5" />
          New Entry
        </button>
      </div>

      {/* New Mileage Entry Form Modal */}
      {showNewMileageForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>Record Mileage</h2>
            <form onSubmit={handleCreateMileageEntry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Employee *</label>
                <select
                  id="mileage-employee_id"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                  required
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Project</label>
                <select
                  id="mileage-project_id"
                  name="project_id"
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="">Select a project</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Date</label>
                <input
                  type="date"
                  id="mileage-date"
                  name="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Starting Location</label>
                <input
                  type="text"
                  id="mileage-starting_location"
                  name="starting_location"
                  value={formData.starting_location}
                  onChange={(e) => setFormData({ ...formData, starting_location: e.target.value })}
                  placeholder="Office address"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Destination</label>
                <input
                  type="text"
                  id="mileage-destination"
                  name="destination"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="Project site address"
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Miles Driven *</label>
                  <input
                    type="number"
                    id="mileage-miles_driven"
                    name="miles_driven"
                    step="0.1"
                    value={formData.miles_driven}
                    onChange={(e) => setFormData({ ...formData, miles_driven: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Rate ($/mi)</label>
                  <input
                    type="number"
                    id="mileage-reimbursement_rate"
                    name="reimbursement_rate"
                    step="0.01"
                    value={formData.reimbursement_rate}
                    onChange={(e) => setFormData({ ...formData, reimbursement_rate: e.target.value })}
                    placeholder="0.65"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Notes</label>
                <textarea
                  id="mileage-notes"
                  name="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Trip details or notes"
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewMileageForm(false)}
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
                  Record Mileage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Miles</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{totalMiles.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Reimbursement</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(totalReimbursement)}</p>
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Entries</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{filteredEntries.length}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          <input
            type="text"
            id="mileage-search"
            name="search"
            placeholder="Search by location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
          />
        </div>
      </div>

      {/* Mileage Entries Table */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--color-muted)' }}>
          <p>Loading mileage entries...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <p style={{ color: 'var(--color-muted)' }}>No mileage entries found. Record your first trip to get started!</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl p-4 active:opacity-75"
                style={{ border: `1px solid var(--color-border)` }}
                onClick={() => handleEditMileageEntry(entry)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base" style={{ color: 'var(--color-navy)' }}>{getEmployeeName(entry.employee_id)}</p>
                    <div className="flex items-center gap-1 text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
                      <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{entry.starting_location} → {entry.destination}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                      {formatDate(entry.date)} · {getProjectName(entry.project_id)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-lg" style={{ color: 'var(--color-navy)' }}>{formatCurrency(calculateReimbursement(entry))}</p>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{entry.miles_driven.toFixed(1)} mi</p>
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteMileageEntry(entry.id) }}
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
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Employee</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Project</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Route</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Miles</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Reimbursement</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: `1px solid var(--color-border)`, cursor: 'pointer' }}
                    className="hover:opacity-75 transition"
                    onDoubleClick={() => handleEditMileageEntry(entry)}
                  >
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(entry.date)}</td>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{getEmployeeName(entry.employee_id)}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{getProjectName(entry.project_id)}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>
                      <div className="flex items-center gap-1">
                        <Navigation className="w-4 h-4" />
                        <span>{entry.starting_location} → {entry.destination}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-center font-medium" style={{ color: 'var(--color-navy)' }}>
                      {entry.miles_driven.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                      {formatCurrency(calculateReimbursement(entry))}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleDeleteMileageEntry(entry.id)}
                        className="hover:opacity-80 transition"
                        style={{ color: 'var(--color-destructive)' }}
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
      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Edit Mileage Entry</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Employee</label>
                <select
                  value={editFormData.employee_id}
                  onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Project</label>
                <select
                  value={editFormData.project_id}
                  onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="">No project</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Date</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Starting Location</label>
                <input
                  type="text"
                  value={editFormData.starting_location}
                  onChange={(e) => setEditFormData({ ...editFormData, starting_location: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Destination</label>
                <input
                  type="text"
                  value={editFormData.destination}
                  onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Miles Driven</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.miles_driven}
                    onChange={(e) => setEditFormData({ ...editFormData, miles_driven: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Rate ($/mi)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.reimbursement_rate}
                    onChange={(e) => setEditFormData({ ...editFormData, reimbursement_rate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg hover:opacity-80 transition"
                  style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditedEntry}
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition"
                  style={{ backgroundColor: 'var(--color-navy)' }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
