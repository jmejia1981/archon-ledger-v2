'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { irsMileageRate } from '@/lib/calculations'
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

const DAY_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getSaturday(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 6 ? 0 : -(day + 1)))
  return toLocalISODate(d)
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalISODate(d)
}

export default function MileagePage() {
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<MileageEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [laborEntries, setLaborEntries] = useState<any[]>([])
  const [showGaps, setShowGaps] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewMileageForm, setShowNewMileageForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<any>(null)
  // Same route most days, so a week is entered once and the miles vary by day.
  // Weeks run Saturday–Friday to match the labor and payroll pages, and are formatted
  // from local calendar parts: toISOString would shift the date west of UTC in the
  // evening and file a day into the wrong week.
  const [formMode, setFormMode] = useState<'single' | 'week'>('single')
  const [weekStart, setWeekStart] = useState(() => getSaturday(new Date()))
  const [weekMiles, setWeekMiles] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    employee_id: '',
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    starting_location: '',
    destination: '',
    miles_driven: '',
    reimbursement_rate: String(irsMileageRate(new Date().toISOString().split('T')[0])),
    notes: '',
  })

  // Load mileage entries, employees, and projects
  useEffect(() => {
    const loadData = async () => {
      try {
        const [mileageData, employeesData, projectsData, laborData] = await Promise.all([
          supabase.from('mileage_entries').select('*').order('date', { ascending: false }),
          supabase.from('employees').select('id, name, first_name, last_name'),
          supabase.from('projects').select('id, project_name'),
          supabase.from('labor_entries').select('date, project_id, regular_hours, overtime_hours, week_start_date, week_end_date'),
        ])

        // Map employees to handle both old (name) and new (first_name + last_name) formats
        const formattedEmployees = (employeesData.data || []).map((emp: any) => ({
          id: emp.id,
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        }))

        setMileageEntries(mileageData.data || [])
        setEmployees(formattedEmployees)
        setProjects(projectsData.data || [])
        setLaborEntries(laborData.data || [])
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
  // Work recorded against a project with no trip logged for it. Employee is ignored
  // deliberately: a crew travels together, so the question is whether the site was
  // driven to that day, not who drove.
  //
  // A labor row carrying week_start_date covers a whole week on one date, so asking
  // for a trip on that exact date would be wrong. Those are matched against any trip
  // to the project within their week; single-day rows match on the day itself.
  // The drive to a site is the same drive every time: across 85 trips, every project
  // has exactly one mileage, one start and one destination. So selecting a project
  // fills the route and the distance from its last recorded trip rather than asking
  // again. Newest first, so a corrected figure is the one that carries forward.
  const lastTripForProject = (projectId: string) => {
    if (!projectId) return null
    return (
      [...mileageEntries]
        .filter((m) => m.project_id === projectId)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null
    )
  }

  const applyProjectDefaults = (projectId: string) => {
    const last = lastTripForProject(projectId)
    setFormData((prev) => ({
      ...prev,
      project_id: projectId,
      // Only fills blanks, so anything typed by hand is never overwritten.
      starting_location: prev.starting_location || last?.starting_location || '',
      destination: prev.destination || last?.destination || '',
      miles_driven: prev.miles_driven || (last ? String(last.miles_driven) : ''),
    }))
  }

  const mileageGaps = (() => {
    const projectName = (id: string | null) =>
      !id ? 'No project' : projects.find((p) => p.id === id)?.project_name || 'Unknown project'

    const hasTrip = (projectId: string | null, from: string, to: string) =>
      mileageEntries.some(
        (m) => (m.project_id || null) === (projectId || null) && m.date >= from && m.date <= to,
      )

    const seen = new Map<string, { key: string; label: string; project: string; hours: number; span: string }>()
    for (const l of laborEntries) {
      const weekly = Boolean(l.week_start_date && l.week_end_date)
      const from = weekly ? String(l.week_start_date).slice(0, 10) : String(l.date).slice(0, 10)
      const to = weekly ? String(l.week_end_date).slice(0, 10) : from
      if (!from) continue
      const key = `${from}|${l.project_id || 'none'}`
      const hours = Number(l.regular_hours || 0) + Number(l.overtime_hours || 0)
      const existing = seen.get(key)
      if (existing) {
        existing.hours += hours
        continue
      }
      if (hasTrip(l.project_id || null, from, to)) continue
      seen.set(key, {
        key,
        label: from,
        project: projectName(l.project_id || null),
        hours,
        span: weekly ? 'week' : 'day',
      })
    }
    return [...seen.values()].sort((a, b) => b.label.localeCompare(a.label))
  })()

  const gapHours = mileageGaps.reduce((s2, g) => s2 + g.hours, 0)

  const projectMiles = (() => {
    const last = lastTripForProject(formData.project_id)
    return last ? Number(last.miles_driven) : null
  })()

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekTotalMiles = weekDays.reduce((sum, d) => sum + (parseFloat(weekMiles[d] || '') || 0), 0)
  // Each day is priced at the rate in force on that date, so a week spanning a rate
  // change is costed correctly rather than at one flat rate.
  const weekTotalValue = weekDays.reduce(
    (sum, d) => sum + (parseFloat(weekMiles[d] || '') || 0) * irsMileageRate(d),
    0,
  )

  const resetForm = () => {
    const today = toLocalISODate(new Date())
    setFormData({
      employee_id: '',
      project_id: '',
      date: today,
      starting_location: '',
      destination: '',
      miles_driven: '',
      reimbursement_rate: String(irsMileageRate(today)),
      notes: '',
    })
    setWeekMiles({})
  }

  // One row per day with miles against it. Days left blank are skipped rather than
  // written as zero, so a four-day week does not leave three empty trips behind.
  const handleCreateWeekMileage = async () => {
    if (!formData.employee_id) {
      alert('Employee is required')
      return
    }
    const rows = weekDays
      .filter((d) => (parseFloat(weekMiles[d] || '') || 0) > 0)
      .map((d) => ({
        employee_id: formData.employee_id,
        project_id: formData.project_id || null,
        date: d,
        starting_location: formData.starting_location,
        destination: formData.destination,
        miles_driven: parseFloat(weekMiles[d]),
        reimbursement_rate: irsMileageRate(d),
        notes: formData.notes,
      }))

    if (rows.length === 0) {
      alert('Enter miles for at least one day')
      return
    }

    try {
      const { data, error } = await supabase.from('mileage_entries').insert(rows).select()
      if (error) throw error
      if (data) {
        setMileageEntries(
          [...mileageEntries, ...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        )
        resetForm()
        setShowNewMileageForm(false)
        alert(`Recorded ${rows.length} day${rows.length === 1 ? '' : 's'}, ${weekTotalMiles.toFixed(1)} miles.`)
      }
    } catch (err: any) {
      console.error('Error creating weekly mileage:', err)
      alert('Failed to record the week: ' + (err?.message || JSON.stringify(err)))
    }
  }

  const handleCreateMileageEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formMode === 'week') {
      await handleCreateWeekMileage()
      return
    }
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
            reimbursement_rate: parseFloat(formData.reimbursement_rate) || irsMileageRate(formData.date),
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
        setMileageEntries([...mileageEntries, ...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        setFormData({
          employee_id: '',
          project_id: '',
          date: new Date().toISOString().split('T')[0],
          starting_location: '',
          destination: '',
          miles_driven: '',
          reimbursement_rate: String(irsMileageRate(new Date().toISOString().split('T')[0])),
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
        reimbursement_rate: parseFloat(editFormData.reimbursement_rate) || irsMileageRate(editFormData.date),
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
      month: '2-digit',
      day: '2-digit',
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

      {/* Work logged against a project with no trip recorded for it. Mileage is a
          deduction that has to be claimed to exist, so an unlogged run is money left
          behind — and it is far harder to reconstruct months later. */}
      {mileageGaps.length > 0 && (
        <div className="rounded-lg" style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d' }}>
          <button
            onClick={() => setShowGaps(!showGaps)}
            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                {mileageGaps.length} project {mileageGaps.length === 1 ? 'period' : 'periods'} with labor but no mileage
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                {gapHours.toFixed(1)} hours worked with no trip logged to that site
              </p>
            </div>
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#92400e' }}>
              {showGaps ? 'Hide' : 'Show'}
            </span>
          </button>

          {showGaps && (
            <div className="px-4 pb-4">
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'white' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-linen)' }}>
                      {['Date', 'Covers', 'Project', 'Hours'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${i === 3 ? 'text-right' : 'text-left'}`}
                          style={{ color: 'var(--color-navy)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mileageGaps.map((g) => (
                      <tr key={g.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td className="px-3 py-2 text-sm whitespace-nowrap" style={{ color: 'var(--color-navy)' }}>
                          {new Date(g.label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                          {g.span === 'week' ? 'that week' : 'that day'}
                        </td>
                        <td className="px-3 py-2 text-sm" style={{ color: 'var(--color-muted)' }}>{g.project}</td>
                        <td className="px-3 py-2 text-sm text-right" style={{ color: 'var(--color-navy)' }}>{g.hours.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mt-2" style={{ color: '#92400e' }}>
                Listed, not assumed — a trip is only a deduction if it happened. Record the ones that did.
              </p>
            </div>
          )}
        </div>
      )}

      {/* New Mileage Entry Form Modal */}
      {showNewMileageForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>Record Mileage</h2>

            <div className="flex gap-2 mb-4">
              {([['single', 'Single Day'], ['week', 'Entire Week']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFormMode(mode)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                  style={formMode === mode
                    ? { backgroundColor: 'var(--color-navy)', color: 'white' }
                    : { border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
                >
                  {label}
                </button>
              ))}
            </div>

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
                  onChange={(e) => applyProjectDefaults(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                >
                  <option value="">Select a project</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                  ))}
                </select>
                {projectMiles !== null && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                    Last trip to this site: <strong>{projectMiles} mi</strong> — route and distance filled in.
                  </p>
                )}
              </div>

              {formMode === 'single' ? (
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
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Week starting (Saturday)</label>
                  <input
                    type="date"
                    id="mileage-week-start"
                    name="weekStart"
                    value={weekStart}
                    onChange={(e) => e.target.value && setWeekStart(getSaturday(new Date(e.target.value + 'T00:00:00')))}
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                    Any date snaps to that week&apos;s Saturday, matching labor and payroll weeks.
                  </p>
                </div>
              )}

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

              {formMode === 'week' ? (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-muted)' }}>Miles per day</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {weekDays.map((d, i) => (
                      <div key={d}>
                        <label htmlFor={`mileage-day-${d}`} className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
                          {DAY_LABELS[i]} <span className="opacity-60">{d.slice(8)}</span>
                        </label>
                        <input
                          id={`mileage-day-${d}`}
                          name={`miles-${d}`}
                          type="number"
                          step="0.1"
                          min="0"
                          inputMode="decimal"
                          value={weekMiles[d] || ''}
                          onChange={(e) => setWeekMiles((prev) => ({ ...prev, [d]: e.target.value }))}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border text-sm focus-visible:outline-none"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Fills every day but Sunday at once; most weeks are the same run repeated. */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Fill all:</span>
                    {[...new Set([...(projectMiles ? [projectMiles] : []), 28, 40, 50])].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setWeekMiles(Object.fromEntries(
                          weekDays.map((d, i) => [d, i === 1 ? (weekMiles[d] || '') : String(n)]),
                        ))}
                        className="px-2.5 py-1 rounded text-xs font-medium"
                        style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)' }}
                      >
                        {n} mi
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setWeekMiles({})}
                      className="px-2.5 py-1 rounded text-xs font-medium"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-3 rounded-lg px-3 py-2 flex items-baseline justify-between"
                    style={{ backgroundColor: 'var(--color-linen)' }}>
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      {weekDays.filter((d) => (parseFloat(weekMiles[d] || '') || 0) > 0).length} day(s)
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-navy)' }}>
                      {weekTotalMiles.toFixed(1)} mi · {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(weekTotalValue)}
                    </span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                    Each day uses the IRS rate for its own date. Blank days are skipped.
                  </p>
                </div>
              ) : (
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
                    placeholder="0.76"
                    className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  />
                </div>
              </div>
              )}

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
                    <td className="px-6 py-4 text-sm whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>{formatDate(entry.date)}</td>
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
