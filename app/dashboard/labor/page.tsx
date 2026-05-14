'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Trash2, CheckCircle, Clock, X, List, CalendarDays } from 'lucide-react'

interface LaborEntry {
  id: string
  employee_id: string
  project_id: string
  date: string
  regular_hours: number
  overtime_hours: number
  task_description: string
  status: string
}

interface Employee {
  id: string
  name: string
  hourly_rate: number
}

interface Project {
  id: string
  project_name: string
}

interface WeeklyDayEntry {
  hours: string
}

export default function LaborPage() {
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<LaborEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewLaborForm, setShowNewLaborForm] = useState(false)
  const [formMode, setFormMode] = useState<'single' | 'week'>('single')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [listView, setListView] = useState<'entries' | 'week'>('entries')
  const [editWeeklyData, setEditWeeklyData] = useState<Record<string, WeeklyDayEntry>>({
    mon: { hours: '' },
    tue: { hours: '' },
    wed: { hours: '' },
    thu: { hours: '' },
    fri: { hours: '' },
    sat: { hours: '' },
    sun: { hours: '' },
  })

  const [formData, setFormData] = useState({
    employee_id: '',
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    regular_hours: '',
    overtime_hours: '',
    task_description: '',
    status: 'pending',
  })

  const [weekStartDate, setWeekStartDate] = useState(getMonday(new Date()).toISOString().split('T')[0])
  const [weeklyData, setWeeklyData] = useState<Record<string, WeeklyDayEntry>>({
    mon: { hours: '' },
    tue: { hours: '' },
    wed: { hours: '' },
    thu: { hours: '' },
    fri: { hours: '' },
    sat: { hours: '' },
    sun: { hours: '' },
  })

  function getMonday(date: Date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  function getWeekDays(startDate: string) {
    const start = new Date(startDate)
    const days = []
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      days.push({
        key: dayKeys[i],
        name: dayNames[i],
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
      })
    }
    return days
  }

  const weekDays = getWeekDays(weekStartDate)
  const totalWeeklyHours = Object.values(weeklyData).reduce((sum, day) => sum + (parseFloat(day.hours) || 0), 0)

  const supabase = createClient()

  // Load labor entries, employees, and projects
  useEffect(() => {
    const loadData = async () => {
      try {
        const [laborData, employeesData, projectsData] = await Promise.all([
          supabase.from('labor_entries').select('*'),
          supabase.from('employees').select('id, name, first_name, last_name, hourly_rate'),
          supabase.from('projects').select('id, project_name'),
        ])

        // Map employees to handle both old (name) and new (first_name + last_name) formats
        const formattedEmployees = (employeesData.data || []).map((emp: any) => ({
          id: emp.id,
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          hourly_rate: emp.hourly_rate,
        }))

        setLaborEntries(laborData.data || [])
        setEmployees(formattedEmployees)
        setProjects(projectsData.data || [])
      } catch (error) {
        console.log('Error loading data - tables may not exist yet')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Filter and search labor entries
  useEffect(() => {
    let filtered = laborEntries

    if (statusFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (entry) =>
          entry.task_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredEntries(filtered)
  }, [laborEntries, statusFilter, searchTerm])

  // Handle create labor entry
  const handleCreateLaborEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employee_id || !formData.project_id) {
      alert('Employee and project are required')
      return
    }

    try {
      console.log(`Creating labor entry in ${formMode} mode`)

      if (formMode === 'single') {
        // Single day entry
        console.log('Creating single day entry:', formData)
        const { data, error } = await supabase
          .from('labor_entries')
          .insert([
            {
              employee_id: formData.employee_id,
              project_id: formData.project_id,
              date: formData.date,
              regular_hours: parseFloat(formData.regular_hours) || 0,
              overtime_hours: parseFloat(formData.overtime_hours) || 0,
              task_description: formData.task_description,
              status: formData.status,
            },
          ])
          .select()

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(`Failed to create: ${error.message}`)
        }

        console.log('Labor entry created successfully:', data)
        if (data) {
          setLaborEntries([...laborEntries, ...data])
          setFormData({
            employee_id: '',
            project_id: '',
            date: new Date().toISOString().split('T')[0],
            regular_hours: '',
            overtime_hours: '',
            task_description: '',
            status: 'pending',
          })
          setShowNewLaborForm(false)
          alert('Labor entry created successfully!')
        }
      } else {
        // Weekly entry - create a single entry for the entire week
        const totalHours = Object.values(weeklyData).reduce((sum, day) => sum + (parseFloat(day.hours) || 0), 0)

        if (totalHours === 0) {
          alert('Please enter hours for at least one day')
          return
        }

        // Get week end date (Sunday of that week)
        const weekStart = new Date(weekStartDate)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        const weekEndDateString = weekEnd.toISOString().split('T')[0]

        const weeklyEntry = {
          employee_id: formData.employee_id,
          project_id: formData.project_id,
          date: weekStartDate,
          week_start_date: weekStartDate,
          week_end_date: weekEndDateString,
          regular_hours: totalHours,
          overtime_hours: 0,
          task_description: formData.task_description,
          status: formData.status,
        }

        console.log('Creating single weekly entry:', weeklyEntry)
        const { data, error } = await supabase
          .from('labor_entries')
          .insert([weeklyEntry])
          .select()

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(`Failed to create: ${error.message}`)
        }

        console.log('Weekly entry created successfully:', data)
        if (data) {
          setLaborEntries([...laborEntries, ...data])
          setFormData({
            employee_id: '',
            project_id: '',
            date: new Date().toISOString().split('T')[0],
            regular_hours: '',
            overtime_hours: '',
            task_description: '',
            status: 'pending',
          })
          setWeeklyData({
            mon: { hours: '' },
            tue: { hours: '' },
            wed: { hours: '' },
            thu: { hours: '' },
            fri: { hours: '' },
            sat: { hours: '' },
            sun: { hours: '' },
          })
          setShowNewLaborForm(false)
          alert(`${data.length} labor entries created successfully!`)
        }
      }
    } catch (error) {
      console.error('Error creating labor entry:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create labor entry'}`)
    }
  }

  // Handle edit labor entry (double-click)
  const handleEditLaborEntry = (entry: LaborEntry) => {
    const isWeekly = (entry as any).week_start_date && (entry as any).week_end_date

    setEditingId(entry.id)
    setEditFormData({
      employee_id: entry.employee_id,
      project_id: entry.project_id,
      date: entry.date,
      week_start_date: (entry as any).week_start_date,
      week_end_date: (entry as any).week_end_date,
      regular_hours: entry.regular_hours,
      overtime_hours: entry.overtime_hours,
      task_description: entry.task_description,
      status: entry.status,
      isWeekly: isWeekly,
    })

    // If it's a weekly entry, initialize the weekly data
    if (isWeekly) {
      // For now, distribute the total hours evenly across the week (user can edit each day)
      const totalHours = entry.regular_hours
      const hoursPerDay = totalHours / 5 // Assume 5 working days
      setEditWeeklyData({
        mon: { hours: hoursPerDay.toString() },
        tue: { hours: hoursPerDay.toString() },
        wed: { hours: hoursPerDay.toString() },
        thu: { hours: hoursPerDay.toString() },
        fri: { hours: hoursPerDay.toString() },
        sat: { hours: '0' },
        sun: { hours: '0' },
      })
    }

    setShowEditModal(true)
  }

  // Handle save edited labor entry
  const handleSaveEditedEntry = async () => {
    if (!editingId || !editFormData) return

    try {
      let updateData: any = {
        task_description: editFormData.task_description,
        status: editFormData.status,
      }

      // If it's a weekly entry, recalculate total hours from the week
      if (editFormData.isWeekly) {
        const totalHours = Object.values(editWeeklyData).reduce((sum, day) => sum + (parseFloat(day.hours) || 0), 0)
        updateData.regular_hours = totalHours
      } else {
        updateData.regular_hours = parseFloat(editFormData.regular_hours) || 0
        updateData.overtime_hours = parseFloat(editFormData.overtime_hours) || 0
      }

      const { error } = await supabase
        .from('labor_entries')
        .update(updateData)
        .eq('id', editingId)

      if (error) throw error

      // Update local state
      setLaborEntries(
        laborEntries.map(entry =>
          entry.id === editingId
            ? { ...entry, ...updateData }
            : entry
        )
      )
      setEditingId(null)
      setEditFormData(null)
      setShowEditModal(false)
      alert('Labor entry updated successfully!')
    } catch (error) {
      console.error('Error updating labor entry:', error)
      alert('Failed to update labor entry')
    }
  }

  // Handle delete labor entry
  const handleDeleteLaborEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this labor entry?')) return

    try {
      await supabase.from('labor_entries').delete().eq('id', id)
      setLaborEntries(laborEntries.filter((e) => e.id !== id))
    } catch (error) {
      console.error('Error deleting labor entry:', error)
    }
  }

  // Handle approve labor entry
  const handleApproveLaborEntry = async (id: string) => {
    try {
      await supabase
        .from('labor_entries')
        .update({ status: 'approved' })
        .eq('id', id)

      setLaborEntries(
        laborEntries.map((e) =>
          e.id === id ? { ...e, status: 'approved' } : e
        )
      )
    } catch (error) {
      console.error('Error approving labor entry:', error)
    }
  }

  const getEmployeeName = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.name || 'Unknown'
  }

  const getEmployeeRate = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.hourly_rate || 0
  }

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.project_name || 'Unknown'
  }

  const calculateLaborCost = (entry: LaborEntry) => {
    const rate = getEmployeeRate(entry.employee_id)
    return entry.regular_hours * rate + entry.overtime_hours * rate * 1.5
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
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
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const totalHours = filteredEntries.reduce((sum, e) => sum + e.regular_hours + e.overtime_hours, 0)
  const totalCost = filteredEntries.reduce((sum, e) => sum + calculateLaborCost(e), 0)

  // Group entries by ISO week (Mon–Sun)
  const getWeekStart = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(d.setDate(diff))
    return mon.toISOString().split('T')[0]
  }

  const groupedByWeek = filteredEntries.reduce<Record<string, LaborEntry[]>>((acc, entry) => {
    const key = getWeekStart(entry.date)
    if (!acc[key]) acc[key] = []
    acc[key].push(entry)
    return acc
  }, {})

  const sortedWeekKeys = Object.keys(groupedByWeek).sort((a, b) => b.localeCompare(a))

  const formatWeekRange = (weekStart: string) => {
    const start = new Date(weekStart + 'T00:00:00')
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-playfair font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Labor Hours</h1>
          <p style={{ color: 'var(--color-muted)' }}>Track and manage employee time entries</p>
        </div>
        <button
          onClick={() => setShowNewLaborForm(true)}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-navy)' }}
        >
          <Plus className="w-5 h-5" />
          New Entry
        </button>
      </div>

      {/* New Labor Entry Form Modal */}
      {showNewLaborForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Log Labor Hours</h2>
                  <p style={{ color: 'var(--color-muted)' }}>Add time entries for an employee - single day or entire week.</p>
                </div>
                <button
                  onClick={() => setShowNewLaborForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setFormMode('single')}
                  className={`px-4 py-2 font-medium transition ${
                    formMode === 'single'
                      ? 'border-b-2'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  style={{
                    color: formMode === 'single' ? 'var(--color-navy)' : undefined,
                    borderColor: formMode === 'single' ? 'var(--color-navy)' : undefined,
                  }}
                >
                  <Clock className="w-4 h-4 inline mr-2" />
                  Single Day
                </button>
                <button
                  onClick={() => setFormMode('week')}
                  className={`px-4 py-2 font-medium transition ${
                    formMode === 'week'
                      ? 'border-b-2'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  style={{
                    color: formMode === 'week' ? 'var(--color-navy)' : undefined,
                    borderColor: formMode === 'week' ? 'var(--color-navy)' : undefined,
                  }}
                >
                  <Clock className="w-4 h-4 inline mr-2" />
                  Entire Week
                </button>
              </div>

              <form onSubmit={handleCreateLaborEntry} className="space-y-6">
                {formMode === 'single' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                          Employee
                        </label>
                        <select
                          id="labor-employee_id"
                          name="employee_id"
                          value={formData.employee_id}
                          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                          required
                        >
                          <option value="">Select employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} (${emp.hourly_rate}/hr)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                          Project
                        </label>
                        <select
                          id="labor-project_id"
                          name="project_id"
                          value={formData.project_id}
                          onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                          required
                        >
                          <option value="">Select project</option>
                          {projects.map((proj) => (
                            <option key={proj.id} value={proj.id}>
                              {proj.project_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                          Amount *
                        </label>
                        <input
                          type="number"
                          id="labor-regular_hours"
                          name="regular_hours"
                          step="0.25"
                          value={formData.regular_hours}
                          onChange={(e) => setFormData({ ...formData, regular_hours: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                          Date *
                        </label>
                        <input
                          type="date"
                          id="labor-date"
                          name="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                        Task Description
                      </label>
                      <textarea
                        id="labor-task_description"
                        name="task_description"
                        value={formData.task_description}
                        onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                        placeholder="Describe the work performed..."
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowNewLaborForm(false)}
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
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                          Employee
                        </label>
                        <select
                          id="labor-week-employee_id"
                          name="employee_id"
                          value={formData.employee_id}
                          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                          required
                        >
                          <option value="">Select employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} (${emp.hourly_rate}/hr)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                          Project
                        </label>
                        <select
                          id="labor-week-project_id"
                          name="project_id"
                          value={formData.project_id}
                          onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                          required
                        >
                          <option value="">Select project</option>
                          {projects.map((proj) => (
                            <option key={proj.id} value={proj.id}>
                              {proj.project_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-navy)' }}>
                        Week Starting
                      </label>
                      <input
                        type="date"
                        id="labor-weekStartDate"
                        name="weekStartDate"
                        value={weekStartDate}
                        onChange={(e) => {
                          setWeekStartDate(e.target.value)
                          setWeeklyData({
                            mon: { hours: '' },
                            tue: { hours: '' },
                            wed: { hours: '' },
                            thu: { hours: '' },
                            fri: { hours: '' },
                            sat: { hours: '' },
                            sun: { hours: '' },
                          })
                        }}
                        className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((day) => (
                        <div key={day.key}>
                          <p className="text-xs font-semibold text-center mb-1" style={{ color: 'var(--color-navy)' }}>
                            {day.name}
                          </p>
                          <p className="text-xs text-center mb-2" style={{ color: 'var(--color-muted)' }}>
                            {day.date}
                          </p>
                          <input
                            type="number"
                            id={`labor-week_hours-${day.key}`}
                            name={`week_hours-${day.key}`}
                            step="0.25"
                            min="0"
                            value={weeklyData[day.key].hours}
                            onChange={(e) =>
                              setWeeklyData({
                                ...weeklyData,
                                [day.key]: { hours: e.target.value },
                              })
                            }
                            placeholder="0"
                            className="w-full px-2 py-1 rounded text-center border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="text-right" style={{ color: 'var(--color-navy)' }}>
                      <p className="text-sm">Total: {totalWeeklyHours.toFixed(1)}h</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                        Task Description
                      </label>
                      <textarea
                        id="labor-week-task_description"
                        name="task_description"
                        value={formData.task_description}
                        onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                        placeholder="Describe the work performed..."
                        rows={2}
                        className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowNewLaborForm(false)}
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
                        Save {totalWeeklyHours.toFixed(1)}h
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="rounded-lg p-6" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Hours</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{totalHours.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted)' }}>Total Labor Cost</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(totalCost)}</p>
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
            id="labor-search"
            name="search"
            placeholder="Search labor entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
          />
        </div>

        <div className="relative">
          <select
            id="labor-statusFilter"
            name="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border appearance-none pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid var(--color-border)` }}>
          <button
            onClick={() => setListView('entries')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition"
            style={{
              backgroundColor: listView === 'entries' ? 'var(--color-navy)' : 'white',
              color: listView === 'entries' ? 'white' : 'var(--color-navy)',
            }}
          >
            <List className="w-4 h-4" />
            Entries
          </button>
          <button
            onClick={() => setListView('week')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition"
            style={{
              backgroundColor: listView === 'week' ? 'var(--color-navy)' : 'white',
              color: listView === 'week' ? 'white' : 'var(--color-navy)',
            }}
          >
            <CalendarDays className="w-4 h-4" />
            By Week
          </button>
        </div>
      </div>

      {/* Labor Entries */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--color-muted)' }}>
          <p>Loading labor entries...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <p style={{ color: 'var(--color-muted)' }}>No labor entries found. Record hours to get started!</p>
        </div>
      ) : listView === 'entries' ? (
        <div className="rounded-lg overflow-x-auto" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
          <table className="w-full min-w-[640px]">
            <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Employee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Project</th>
                <th className="px-6 py-3 text-center text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Regular Hours</th>
                <th className="px-6 py-3 text-center text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Overtime Hours</th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Labor Cost</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  style={{ borderBottom: `1px solid var(--color-border)`, cursor: 'pointer' }}
                  className="hover:opacity-75 transition"
                  onDoubleClick={() => handleEditLaborEntry(entry)}
                >
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(entry.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{getEmployeeName(entry.employee_id)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>{getProjectName(entry.project_id)}</td>
                  <td className="px-6 py-4 text-sm text-center" style={{ color: 'var(--color-navy)' }}>{entry.regular_hours.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-center" style={{ color: 'var(--color-navy)' }}>{entry.overtime_hours.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(calculateLaborCost(entry))}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[entry.status]}`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    {entry.status === 'pending' && (
                      <button
                        onClick={() => handleApproveLaborEntry(entry.id)}
                        style={{ color: 'var(--color-success)' }}
                        className="hover:opacity-80 transition"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteLaborEntry(entry.id)}
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
      ) : (
        /* Weekly grouped view */
        <div className="space-y-4">
          {sortedWeekKeys.map((weekKey) => {
            const weekEntries = groupedByWeek[weekKey]
            const weekRegular = weekEntries.reduce((s, e) => s + e.regular_hours, 0)
            const weekOvertime = weekEntries.reduce((s, e) => s + e.overtime_hours, 0)
            const weekCost = weekEntries.reduce((s, e) => s + calculateLaborCost(e), 0)
            return (
              <div key={weekKey} className="rounded-lg overflow-x-auto" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
                {/* Week header */}
                <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" style={{ color: 'var(--color-navy)' }} />
                    <span className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>
                      Week of {formatWeekRange(weekKey)}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span style={{ color: 'var(--color-muted)' }}>
                      Regular: <strong style={{ color: 'var(--color-navy)' }}>{weekRegular.toFixed(1)}h</strong>
                    </span>
                    <span style={{ color: 'var(--color-muted)' }}>
                      Overtime: <strong style={{ color: 'var(--color-navy)' }}>{weekOvertime.toFixed(1)}h</strong>
                    </span>
                    <span style={{ color: 'var(--color-muted)' }}>
                      Total: <strong style={{ color: 'var(--color-navy)' }}>{(weekRegular + weekOvertime).toFixed(1)}h</strong>
                    </span>
                    <span style={{ color: 'var(--color-muted)' }}>
                      Cost: <strong style={{ color: 'var(--color-navy)' }}>{formatCurrency(weekCost)}</strong>
                    </span>
                  </div>
                </div>
                {/* Entries in this week */}
                <table className="w-full min-w-[640px]">
                  <thead style={{ borderBottom: `1px solid var(--color-border)` }}>
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Date</th>
                      <th className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Employee</th>
                      <th className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Project</th>
                      <th className="px-6 py-2 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Reg</th>
                      <th className="px-6 py-2 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>OT</th>
                      <th className="px-6 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Cost</th>
                      <th className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>Status</th>
                      <th className="px-6 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {weekEntries.sort((a, b) => a.date.localeCompare(b.date)).map((entry) => (
                      <tr
                        key={entry.id}
                        style={{ borderBottom: `1px solid var(--color-border)`, cursor: 'pointer' }}
                        className="hover:opacity-75 transition"
                        onDoubleClick={() => handleEditLaborEntry(entry)}
                      >
                        <td className="px-6 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{formatDate(entry.date)}</td>
                        <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{getEmployeeName(entry.employee_id)}</td>
                        <td className="px-6 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{getProjectName(entry.project_id)}</td>
                        <td className="px-6 py-3 text-sm text-center" style={{ color: 'var(--color-navy)' }}>{entry.regular_hours.toFixed(2)}</td>
                        <td className="px-6 py-3 text-sm text-center" style={{ color: 'var(--color-navy)' }}>{entry.overtime_hours.toFixed(2)}</td>
                        <td className="px-6 py-3 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>{formatCurrency(calculateLaborCost(entry))}</td>
                        <td className="px-6 py-3 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[entry.status]}`}>
                            {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm flex gap-2">
                          {entry.status === 'pending' && (
                            <button onClick={() => handleApproveLaborEntry(entry.id)} style={{ color: 'var(--color-success)' }} className="hover:opacity-80 transition" title="Approve">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteLaborEntry(entry.id)} className="hover:opacity-80 transition" style={{ color: 'var(--color-destructive)' }}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ border: `1px solid var(--color-border)` }}>
            <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--color-navy)' }}>
              Edit Labor Entry
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
              {editFormData.isWeekly
                ? `Editing weekly entry (${formatDate(editFormData.week_start_date)} - ${formatDate(editFormData.week_end_date)})`
                : `Editing entry for ${getEmployeeName(editFormData.employee_id)} on ${formatDate(editFormData.date)}`}
            </p>

            <div className="space-y-4">
              {editFormData.isWeekly ? (
                // Weekly entry form
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Employee
                      </label>
                      <input
                        type="text"
                        id="labor-edit-employee_name"
                        name="employee_name"
                        value={getEmployeeName(editFormData.employee_id)}
                        disabled
                        className="w-full px-4 py-2 rounded-lg border bg-gray-100"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Project
                      </label>
                      <input
                        type="text"
                        id="labor-edit-project_name"
                        name="project_name"
                        value={getProjectName(editFormData.project_id)}
                        disabled
                        className="w-full px-4 py-2 rounded-lg border bg-gray-100"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {getWeekDays(editFormData.week_start_date).map((day) => (
                      <div key={day.key}>
                        <p className="text-xs font-semibold text-center mb-1" style={{ color: 'var(--color-navy)' }}>
                          {day.name}
                        </p>
                        <p className="text-xs text-center mb-2" style={{ color: 'var(--color-muted)' }}>
                          {day.date}
                        </p>
                        <input
                          type="number"
                          id={`labor-edit-week_hours-${day.key}`}
                          name={`week_hours-${day.key}`}
                          step="0.25"
                          min="0"
                          value={editWeeklyData[day.key].hours}
                          onChange={(e) =>
                            setEditWeeklyData({
                              ...editWeeklyData,
                              [day.key]: { hours: e.target.value },
                            })
                          }
                          placeholder="0"
                          className="w-full px-2 py-1 rounded text-center border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="text-right" style={{ color: 'var(--color-navy)' }}>
                    <p className="text-sm font-semibold">
                      Total: {Object.values(editWeeklyData).reduce((sum, day) => sum + (parseFloat(day.hours) || 0), 0).toFixed(1)}h
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                      Status
                    </label>
                    <select
                      id="labor-edit-week-status"
                      name="status"
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                      Task Description
                    </label>
                    <textarea
                      id="labor-edit-week-task_description"
                      name="task_description"
                      value={editFormData.task_description}
                      onChange={(e) => setEditFormData({ ...editFormData, task_description: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      rows={4}
                    />
                  </div>
                </>
              ) : (
                // Single entry form
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Employee
                      </label>
                      <select
                        id="labor-edit-employee_id"
                        name="employee_id"
                        value={editFormData.employee_id}
                        onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Project
                      </label>
                      <select
                        id="labor-edit-project_id"
                        name="project_id"
                        value={editFormData.project_id}
                        onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                      >
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.project_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Date
                      </label>
                      <input
                        type="date"
                        id="labor-edit-date"
                        name="date"
                        value={editFormData.date}
                        onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Status
                      </label>
                      <select
                        id="labor-edit-status"
                        name="status"
                        value={editFormData.status}
                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Regular Hours
                      </label>
                      <input
                        type="number"
                        id="labor-edit-regular_hours"
                        name="regular_hours"
                        step="0.25"
                        value={editFormData.regular_hours}
                        onChange={(e) => setEditFormData({ ...editFormData, regular_hours: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                        Overtime Hours
                      </label>
                      <input
                        type="number"
                        id="labor-edit-overtime_hours"
                        name="overtime_hours"
                        step="0.25"
                        value={editFormData.overtime_hours}
                        onChange={(e) => setEditFormData({ ...editFormData, overtime_hours: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                      Task Description
                    </label>
                    <textarea
                      id="labor-edit-task_description"
                      name="task_description"
                      value={editFormData.task_description}
                      onChange={(e) => setEditFormData({ ...editFormData, task_description: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      rows={4}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
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
