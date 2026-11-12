'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { irsMileageRate } from '@/lib/calculations'
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle, Trash2, Plus, AlertCircle, Send, Copy, Car } from 'lucide-react'

interface Employee { id: string; name: string; hourly_rate: number; status?: string | null }
interface Project { id: string; project_name: string; status?: string }
interface MileageEntry {
  id: string
  date: string
  project_id: string | null
  miles_driven: number
  starting_location?: string | null
  destination?: string | null
}
interface ScheduleEntry {
  id: string
  date: string
  employee_id: string
  project_id: string | null
  planned_hours: number
  notes?: string | null
  status: 'scheduled' | 'approved'
  labor_entry_id?: string | null
}

const supabase = createClient()

// Pay weeks run Saturday–Friday, matching getWeekStart in the labor and payroll
// pages. Formatted from local calendar parts, never toISOString: the UTC conversion
// shifts the date west of UTC in the evening, which previously made payroll report
// an empty week that had hours in it.
function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getSaturday(d = new Date()) {
  const day = d.getDay()
  const sat = new Date(d)
  sat.setDate(d.getDate() + (day === 6 ? 0 : -(day + 1)))
  return toLocalISODate(sat)
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalISODate(d)
}

const DAY_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function SchedulePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(getSaturday())
  const [activeTab, setActiveTab] = useState<'schedule' | 'payroll'>('schedule')
  const [shareDay, setShareDay] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // What payroll has actually recorded for the week, so the projection can be shown
  // against it rather than in isolation.
  const [payrollRows, setPayrollRows] = useState<any[]>([])
  // Trips already on file, so approval can price each project from its own history
  // and leave any project day that is already claimed alone.
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([])
  const [recordMileage, setRecordMileage] = useState(true)
  const [mileageMiles, setMileageMiles] = useState<Record<string, string>>({})

  // Bulk assignment: a crew, a project, a set of days.
  const [crew, setCrew] = useState<string[]>([])
  const [assignProject, setAssignProject] = useState('')
  const [assignDays, setAssignDays] = useState<string[]>([])
  const [assignHours, setAssignHours] = useState('8')

  const weekEnd = addDays(weekStart, 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [empRes, projRes, schedRes, payRes, milRes] = await Promise.all([
        supabase.from('employees').select('id, name, first_name, last_name, hourly_rate, status'),
        supabase.from('projects').select('id, project_name, status'),
        supabase.from('schedule_entries').select('*'),
        supabase.from('payroll').select('employee_id, payroll_period_start, gross_pay, taxes, benefits'),
        supabase
          .from('mileage_entries')
          .select('id, date, project_id, miles_driven, starting_location, destination'),
      ])
      if (empRes.error) throw empRes.error
      if (projRes.error) throw projRes.error
      if (schedRes.error) throw schedRes.error
      if (payRes.error) throw payRes.error
      if (milRes.error) throw milRes.error
      setPayrollRows(payRes.data || [])
      setMileageEntries((milRes.data || []) as MileageEntry[])

      setEmployees(
        (empRes.data || [])
          .map((e: any) => ({
            id: e.id,
            name: e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unnamed',
            hourly_rate: e.hourly_rate || 0,
            status: e.status,
          }))
          .sort((a: Employee, b: Employee) => a.name.localeCompare(b.name)),
      )
      setProjects(
        (projRes.data || []).sort((a: any, b: any) =>
          String(a.project_name).localeCompare(String(b.project_name)),
        ),
      )
      setEntries((schedRes.data || []) as ScheduleEntry[])
    } catch (err: any) {
      console.error('Error loading schedule:', err)
      setError(err?.message || 'Failed to load the schedule.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // The page lists active people only. The full roster stays loaded so names still
  // resolve for anyone deactivated after their days were recorded — and such a
  // person is kept visible where they already have days this week, since silently
  // dropping them would hide real assignments and understate the week's cost.
  const activeEmployees = employees.filter((e) => e.status !== 'inactive')
  const isInactive = (id: string) => employees.find((e) => e.id === id)?.status === 'inactive'

  const weekEntries = entries.filter((e) => e.date >= weekStart && e.date <= weekEnd)
  const cellEntries = (empId: string, date: string) =>
    weekEntries.filter((e) => e.employee_id === empId && e.date === date)

  const projectName = (id: string | null) =>
    !id ? 'Unassigned' : projects.find((p) => p.id === id)?.project_name || 'Unknown'
  const employeeRate = (id: string) => employees.find((e) => e.id === id)?.hourly_rate || 0

  const pending = weekEntries.filter((e) => e.status === 'scheduled')
  const approved = weekEntries.filter((e) => e.status === 'approved')
  const plannedHours = weekEntries.reduce((s, e) => s + Number(e.planned_hours || 0), 0)
  const plannedCost = weekEntries.reduce(
    (s, e) => s + Number(e.planned_hours || 0) * employeeRate(e.employee_id),
    0,
  )

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
  const fmtCents = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)

  // End-of-week payroll as the schedule currently stands: every scheduled and
  // approved day priced at that person's own rate. It is a projection, not a
  // liability — nothing is owed from a schedule row, and the figure only becomes
  // cost once payroll is run for the week.
  const weekPayrollRecorded = payrollRows.filter((p) => p.payroll_period_start === weekStart)
  const recordedFor = (empId: string) =>
    weekPayrollRecorded
      .filter((p) => p.employee_id === empId)
      .reduce((s2, p) => s2 + Number(p.gross_pay || 0) + Number(p.taxes || 0) + Number(p.benefits || 0), 0)

  const payrollPreview = employees
    .filter((emp) => weekEntries.some((e) => e.employee_id === emp.id))
    .map((emp) => {
      const mine = weekEntries.filter((e) => e.employee_id === emp.id)
      const scheduledHours = mine.filter((e) => e.status === 'scheduled').reduce((s2, e) => s2 + Number(e.planned_hours || 0), 0)
      const approvedHours = mine.filter((e) => e.status === 'approved').reduce((s2, e) => s2 + Number(e.planned_hours || 0), 0)
      const hours = scheduledHours + approvedHours
      return {
        emp,
        scheduledHours,
        approvedHours,
        hours,
        amount: hours * emp.hourly_rate,
        recorded: recordedFor(emp.id),
      }
    })
    .sort((a, b) => b.amount - a.amount)

  const projectedTotal = payrollPreview.reduce((s2, r) => s2 + r.amount, 0)
  const recordedTotal = payrollPreview.reduce((s2, r) => s2 + r.recorded, 0)
  const notYetRun = projectedTotal - recordedTotal

  // ---- Mileage on approval -------------------------------------------------
  // The crew rides together, so a trip belongs to the project day, not to each
  // person on it: one entry per project per date, whoever is on it. The distance to
  // a jobsite does not change, so it comes from that project's last recorded trip
  // and can be corrected per project before approving.
  const lastTripForProject = (projectId: string) =>
    [...mileageEntries]
      .filter((m) => m.project_id === projectId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null

  const hasTrip = (projectId: string, date: string) =>
    mileageEntries.some((m) => m.project_id === projectId && m.date === date)

  const mileagePlan = (() => {
    const seen = new Set<string>()
    const byProject = new Map<string, { projectId: string; dates: string[] }>()
    for (const e of pending) {
      if (!e.project_id) continue
      const key = `${e.date}|${e.project_id}`
      if (seen.has(key)) continue
      seen.add(key)
      // A day already claimed is left alone — writing it twice would overstate a
      // deduction, which is exactly how the August duplicates happened.
      if (hasTrip(e.project_id, e.date)) continue
      const g = byProject.get(e.project_id) || { projectId: e.project_id, dates: [] }
      g.dates.push(e.date)
      byProject.set(e.project_id, g)
    }
    return [...byProject.values()]
      .map((g) => {
        const last = lastTripForProject(g.projectId)
        return {
          projectId: g.projectId,
          dates: g.dates.sort(),
          known: last ? Number(last.miles_driven) : null,
          start: last?.starting_location || '',
          dest: last?.destination || '',
        }
      })
      .sort((a, b) => projectName(a.projectId).localeCompare(projectName(b.projectId)))
  })()

  // Typed value wins; an empty box means "don't claim this one"; otherwise the
  // project's own history fills it.
  const milesBoxValue = (row: { projectId: string; known: number | null }) => {
    const raw = mileageMiles[row.projectId]
    if (raw !== undefined) return raw
    return row.known != null ? String(row.known) : ''
  }
  const milesFor = (row: { projectId: string; known: number | null }) => {
    const v = parseFloat(milesBoxValue(row))
    return Number.isFinite(v) && v > 0 ? v : 0
  }

  const mileageTotals = mileagePlan.reduce(
    (acc, row) => {
      const miles = milesFor(row)
      if (miles <= 0) return { ...acc, missing: acc.missing + 1 }
      return {
        trips: acc.trips + row.dates.length,
        miles: acc.miles + miles * row.dates.length,
        // Each day is priced at the IRS rate in force on that date, so a week that
        // straddles a rate change is costed correctly.
        value: acc.value + row.dates.reduce((s2, d) => s2 + miles * irsMileageRate(d), 0),
        missing: acc.missing,
      }
    },
    { trips: 0, miles: 0, value: 0, missing: 0 },
  )

  const mileageSkipped = (() => {
    const seen = new Set<string>()
    let covered = 0
    let unassigned = 0
    for (const e of pending) {
      if (!e.project_id) {
        const k = `u|${e.date}`
        if (!seen.has(k)) { seen.add(k); unassigned++ }
        continue
      }
      const key = `${e.date}|${e.project_id}`
      if (seen.has(key)) continue
      seen.add(key)
      if (hasTrip(e.project_id, e.date)) covered++
    }
    return { covered, unassigned }
  })()

  const handleBulkAssign = async () => {
    setError(null)
    setNotice(null)
    if (crew.length === 0) { setError('Select at least one person.'); return }
    if (assignDays.length === 0) { setError('Select at least one day.'); return }
    const hours = parseFloat(assignHours)
    if (!hours || hours <= 0) { setError('Enter hours greater than zero.'); return }

    setSaving(true)
    try {
      const rows = crew.flatMap((employee_id) =>
        assignDays.map((date) => ({
          date,
          employee_id,
          project_id: assignProject || null,
          planned_hours: hours,
          status: 'scheduled',
        })),
      )
      // Skips anyone already scheduled for that day and project — the unique index
      // enforces it, and ignoreDuplicates keeps a partial overlap from failing the
      // whole assignment.
      const { error: insErr } = await supabase
        .from('schedule_entries')
        .upsert(rows, { onConflict: 'date,employee_id,project_id', ignoreDuplicates: true })
      if (insErr) throw insErr

      setNotice(
        `Scheduled ${crew.length} × ${assignDays.length} = ${rows.length} assignment${rows.length === 1 ? '' : 's'}.`,
      )
      setAssignDays([])
      await loadData()
    } catch (err: any) {
      console.error('Error scheduling:', err)
      const msg = String(err?.message || '')
      // schedule_entries is the only table on this page with row security, so an
      // expired session loads the page fine from the open tables and then fails only
      // on save. The raw policy message does not suggest signing in again.
      setError(
        /row-level security|42501/i.test(msg)
          ? 'Could not save — your session may have expired. Sign in again and retry.'
          : msg || 'Failed to save the assignments.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (entry: ScheduleEntry) => {
    if (entry.status === 'approved') {
      setError('That day is already approved and has become labor hours. Remove it from Labor Hours instead.')
      return
    }
    setError(null)
    try {
      const { error: delErr } = await supabase.from('schedule_entries').delete().eq('id', entry.id)
      if (delErr) throw delErr
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    } catch (err: any) {
      console.error('Error removing assignment:', err)
      setError(err?.message || 'Failed to remove the assignment.')
    }
  }

  // Approving turns each scheduled day into a labor_entries row and links the two,
  // so a second approval cannot duplicate the hours. Payroll reads labor entries by
  // week, so the hours reach it as soon as this runs — but they only become cost
  // once payroll is actually run for that week.
  const handleApproveWeek = async () => {
    if (pending.length === 0) return
    const totalHours = pending.reduce((s, e) => s + Number(e.planned_hours || 0), 0)
    const willRecordMileage = recordMileage && mileageTotals.trips > 0
    if (!confirm(
      `Approve ${pending.length} scheduled day${pending.length === 1 ? '' : 's'} for the week of ${weekStart}?\n\n` +
      `This creates ${pending.length} labor entr${pending.length === 1 ? 'y' : 'ies'} totalling ` +
      `${totalHours.toFixed(1)} hours. Run payroll for the week afterwards to cost it.` +
      (willRecordMileage
        ? `\n\nAlso records ${mileageTotals.trips} mileage trip${mileageTotals.trips === 1 ? '' : 's'} ` +
          `(${mileageTotals.miles.toFixed(0)} miles, ${fmtCents(mileageTotals.value)} deductible).`
        : ''),
    )) return

    setApproving(true)
    setError(null)
    setNotice(null)
    try {
      const laborRows = pending.map((e) => ({
        employee_id: e.employee_id,
        project_id: e.project_id,
        date: e.date,
        regular_hours: Number(e.planned_hours || 0),
        overtime_hours: 0,
        task_description: e.notes || `Scheduled — ${projectName(e.project_id)}`,
        status: 'approved',
        week_start_date: weekStart,
        week_end_date: weekEnd,
      }))

      const { data: created, error: laborErr } = await supabase
        .from('labor_entries')
        .insert(laborRows)
        .select('id')
      if (laborErr) throw laborErr
      if (!created || created.length !== pending.length) {
        throw new Error(
          `Expected ${pending.length} labor entries, got ${created?.length ?? 0}. Nothing was marked approved.`,
        )
      }

      // Insert order matches `pending`, so the returned ids pair up positionally.
      for (let i = 0; i < pending.length; i++) {
        const { error: updErr } = await supabase
          .from('schedule_entries')
          .update({
            status: 'approved',
            labor_entry_id: created[i].id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pending[i].id)
        if (updErr) throw updErr
      }

      // Mileage comes last and on its own: the hours are already approved and linked
      // at this point, so a failure here is reported rather than left to look like a
      // failed approval. Trips are per project day, with the employee on the row
      // taken from that day's crew because a trip still has to belong to somebody.
      let mileageNote = ''
      if (willRecordMileage) {
        const mileageRows = mileagePlan.flatMap((row) => {
          const miles = milesFor(row)
          if (miles <= 0) return []
          return row.dates.map((date) => {
            const crew = pending.filter((e) => e.date === date && e.project_id === row.projectId)
            return {
              employee_id: crew[0]?.employee_id || null,
              project_id: row.projectId,
              date,
              starting_location: row.start || 'Office',
              destination: row.dest || projectName(row.projectId),
              miles_driven: miles,
              reimbursement_rate: irsMileageRate(date),
              notes: `Crew trip recorded on schedule approval — week of ${weekStart}`,
            }
          })
        })
        if (mileageRows.length > 0) {
          const { error: milErr } = await supabase.from('mileage_entries').insert(mileageRows)
          if (milErr) {
            console.error('Error recording mileage:', milErr)
            setError(
              `Hours were approved, but the mileage could not be recorded: ${milErr.message}. ` +
              `Add those trips on the Mileage page.`,
            )
          } else {
            mileageNote =
              ` Recorded ${mileageRows.length} mileage trip${mileageRows.length === 1 ? '' : 's'} ` +
              `(${mileageTotals.miles.toFixed(0)} miles, ${fmtCents(mileageTotals.value)}).`
          }
        }
      }

      setNotice(
        `Approved ${pending.length} day${pending.length === 1 ? '' : 's'} into labor hours.` +
        mileageNote +
        ` Run payroll for the week of ${weekStart} to turn it into cost.`,
      )
      setMileageMiles({})
      await loadData()
    } catch (err: any) {
      console.error('Error approving week:', err)
      setError(err?.message || 'Failed to approve the week.')
    } finally {
      setApproving(false)
    }
  }

  // Crews are told where to go, not what it costs — the message carries first names
  // under each project and nothing else. Names come from the roster rather than the
  // picker so someone deactivated mid-week still appears on a day they are on.
  const firstName = (full: string) => String(full || '').trim().split(/\s+/)[0] || full

  const dayLabel = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })

  const buildDayMessage = (date: string) => {
    const forDay = weekEntries.filter((e) => e.date === date)
    if (forDay.length === 0) return ''

    const byProject = new Map<string, string[]>()
    for (const e of forDay) {
      const label = projectName(e.project_id)
      const name = firstName(employees.find((x) => x.id === e.employee_id)?.name || '')
      if (!name) continue
      const list = byProject.get(label) || []
      if (!list.includes(name)) list.push(name)
      byProject.set(label, list)
    }

    // Unassigned last; it is the exception, not a site.
    const blocks = [...byProject.entries()]
      .sort((a, b) => {
        if (a[0] === 'Unassigned') return 1
        if (b[0] === 'Unassigned') return -1
        return a[0].localeCompare(b[0])
      })
      .map(([proj, names]) => {
        // Asterisks are WhatsApp's bold markers, so each site reads as a heading.
        const roster = names.sort((a, b) => a.localeCompare(b)).map((n) => `• ${n}`).join('\n')
        return `*${proj}*\n${roster}`
      })

    return `*${dayLabel(date)}*\n\n${blocks.join('\n\n')}`
  }

  const shareDate = shareDay && days.includes(shareDay)
    ? shareDay
    : days.find((d) => weekEntries.some((e) => e.date === d)) || days[0]
  const shareMessage = buildDayMessage(shareDate)

  const handleCopyDay = async () => {
    if (!shareMessage) return
    try {
      await navigator.clipboard.writeText(shareMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access needs a secure context and can be refused outright. Falling
      // back to a prompt keeps the text reachable instead of failing silently.
      window.prompt('Copy the schedule below:', shareMessage)
    }
  }

  const handleWhatsApp = () => {
    if (!shareMessage) return
    // wa.me opens the share sheet so the group can be chosen there; a group cannot be
    // addressed directly without its invite link.
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank', 'noopener,noreferrer')
  }

  const inputStyle = { border: '1px solid var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>Schedule</h1>
          <p className="hidden sm:block text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Assign crew to projects day by day, then approve the week to create labor hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg" style={inputStyle} title="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={inputStyle}>
            <CalendarDays className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
            <input
              id="schedule-week"
              name="weekStart"
              type="date"
              value={weekStart}
              onChange={(e) => e.target.value && setWeekStart(getSaturday(new Date(e.target.value + 'T00:00:00')))}
              className="text-sm focus:outline-none"
              style={{ color: 'var(--color-navy)' }}
            />
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg" style={inputStyle} title="Next week">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 flex items-start gap-2" style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca' }}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#991b1b' }} />
          <p className="text-sm" style={{ color: '#991b1b' }}>{error}</p>
        </div>
      )}
      {notice && (
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' }}>
          <p className="text-sm" style={{ color: '#065f46' }}>{notice}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {([
          ['schedule', 'Schedule'],
          ['payroll', `End-of-Week Payroll${projectedTotal > 0 ? ` — ${fmt(projectedTotal)}` : ''}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="px-1 py-3 text-sm font-medium whitespace-nowrap"
            style={{
              color: activeTab === key ? (key === 'payroll' ? '#dc2626' : 'var(--color-navy)') : 'var(--color-muted)',
              borderBottom: activeTab === key
                ? `2px solid ${key === 'payroll' ? '#dc2626' : 'var(--color-navy)'}`
                : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Scheduled Hours', value: plannedHours.toFixed(1) },
          { label: 'Planned Cost', value: fmt(plannedCost) },
          { label: 'Awaiting Approval', value: `${pending.length} day${pending.length === 1 ? '' : 's'}` },
          { label: 'Approved', value: `${approved.length} day${approved.length === 1 ? '' : 's'}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{value}</p>
          </div>
        ))}
      </div>

      {activeTab === 'schedule' && (
      <div className="flex flex-col gap-6">
      {/* Bulk assign */}
      <div className="order-2 sm:order-1 bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-linen)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Assign Crew</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Pick the people, the project and the days — one assignment is created per person per day
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
                Crew {crew.length > 0 && `(${crew.length})`}
              </label>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setCrew(activeEmployees.map((e) => e.id))} className="font-medium" style={{ color: '#0066cc' }}>All</button>
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <button type="button" onClick={() => setCrew([])} className="font-medium" style={{ color: 'var(--color-muted)' }}>Clear</button>
              </div>
            </div>
            <div className="rounded-lg overflow-y-auto" style={{ border: '1px solid var(--color-border)', maxHeight: '11rem' }}>
              {activeEmployees.length === 0 ? (
                <p className="px-3 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>No active employees.</p>
              ) : activeEmployees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <input
                    type="checkbox"
                    name="crew"
                    value={emp.id}
                    checked={crew.includes(emp.id)}
                    className="w-4 h-4"
                    onChange={() => setCrew((p) => (p.includes(emp.id) ? p.filter((i) => i !== emp.id) : [...p, emp.id]))}
                  />
                  <span className="text-sm" style={{ color: 'var(--color-navy)' }}>{emp.name}</span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--color-muted)' }}>${emp.hourly_rate}/hr</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="schedule-project" className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Project</label>
              <select
                id="schedule-project"
                name="project_id"
                value={assignProject}
                onChange={(e) => setAssignProject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={inputStyle}
              >
                <option value="">Unassigned / Overhead</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="schedule-hours" className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>Hours per day</label>
              <input
                id="schedule-hours"
                name="planned_hours"
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={assignHours}
                onChange={(e) => setAssignHours(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Days to schedule {assignDays.length > 0 && `(${assignDays.length})`}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {days.map((d, i) => {
                const on = assignDays.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAssignDays((p) => (on ? p.filter((x) => x !== d) : [...p, d]))}
                    className="px-2 py-2 rounded-lg text-xs font-medium text-left"
                    style={on
                      ? { backgroundColor: 'var(--color-navy)', color: 'white' }
                      : { border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
                  >
                    {DAY_LABELS[i]} {d.slice(8)}
                  </button>
                )
              })}
            </div>
            {/* Says what is missing instead of refusing silently. The page-level error
                banner sits far above this button, so a validation failure here was
                invisible from where it was triggered — the click simply looked
                ignored. There are also two sets of day buttons on this page, this
                one and the share panel's, which makes picking the wrong set easy. */}
            <button
              onClick={handleBulkAssign}
              disabled={saving || crew.length === 0 || assignDays.length === 0}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}
            >
              <Plus className="w-4 h-4" />
              {saving
                ? 'Scheduling...'
                : crew.length === 0 && assignDays.length === 0
                ? 'Pick crew and days'
                : crew.length === 0
                ? 'Pick at least one person'
                : assignDays.length === 0
                ? 'Pick at least one day'
                : `Schedule ${crew.length * assignDays.length}`}
            </button>
            {error && (
              <p className="text-xs mt-2" style={{ color: '#991b1b' }}>{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Send the day to the crew. Ordered before the grid because on a phone this is
          the reason to open the page: the grid needs sideways scrolling, this does not. */}
      <div className="order-1 sm:order-2 bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-linen)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Send the Day to the Crew</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            First names grouped by project — nothing about rates or hours
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {days.map((d, i) => {
              const count = weekEntries.filter((e) => e.date === d).length
              const on = d === shareDate
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setShareDay(d)}
                  className="px-2 py-2 rounded-lg text-xs font-medium"
                  style={on
                    ? { backgroundColor: 'var(--color-navy)', color: 'white' }
                    : { border: '1px solid var(--color-border)', color: count > 0 ? 'var(--color-navy)' : 'var(--color-muted)', backgroundColor: 'white' }}
                >
                  <span className="block">{DAY_LABELS[i]}</span>
                  <span className="block text-xs font-normal opacity-70">{count > 0 ? `${count}` : '—'}</span>
                </button>
              )
            })}
          </div>

          {shareMessage ? (
            <>
              {/* Shows the exact text that will be sent — no surprises after tapping. */}
              <pre
                className="text-sm whitespace-pre-wrap rounded-lg p-4 font-sans"
                style={{ backgroundColor: 'var(--color-linen)', color: 'var(--color-navy)', margin: 0 }}
              >
                {shareMessage.replace(/\*/g, '')}
              </pre>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: '#25D366', color: 'white' }}
                >
                  <Send className="w-4 h-4" />
                  Send on WhatsApp
                </button>
                <button
                  onClick={handleCopyDay}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-navy)', backgroundColor: 'white' }}
                >
                  {copied ? <CheckCircle className="w-4 h-4" style={{ color: '#059669' }} /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                WhatsApp opens with the message ready — pick the group there.
              </p>
            </>
          ) : (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-muted)' }}>
              Nobody scheduled on {dayLabel(shareDate)}.
            </p>
          )}
        </div>
      </div>

      {/* Week grid */}
      <div className="order-3 bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--color-navy)' }}>
          <span className="font-bold text-sm text-white">Sat {weekStart.slice(5)} – Fri {weekEnd.slice(5)}</span>
          <button
            onClick={handleApproveWeek}
            disabled={approving || pending.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed self-start sm:self-auto"
            style={{ backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <CheckCircle className="w-4 h-4" />
            {approving ? 'Approving...' : pending.length === 0 ? 'Nothing to approve' : `Approve week (${pending.length})`}
          </button>
        </div>

        {/* Mileage on approval. One trip per project day, priced from that project's
            last trip, so the deduction is captured at the same moment the hours are
            — which is the only time anyone remembers the driving happened. */}
        {pending.length > 0 && (
          <div className="px-4 sm:px-6 py-4" style={{ backgroundColor: 'var(--color-linen)', borderBottom: '1px solid var(--color-border)' }}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={recordMileage}
                onChange={(e) => setRecordMileage(e.target.checked)}
                className="mt-0.5 w-4 h-4 flex-shrink-0"
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  <Car className="w-4 h-4" />
                  Also record mileage for these days
                </span>
                <span className="block text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  {mileagePlan.length === 0
                    ? 'Every project day this week already has a trip on file.'
                    : `One trip per project per day — ${mileageTotals.trips} trip${mileageTotals.trips === 1 ? '' : 's'}, ` +
                      `${mileageTotals.miles.toFixed(0)} miles, ${fmtCents(mileageTotals.value)} deductible.`}
                </span>
              </span>
            </label>

            {recordMileage && mileagePlan.length > 0 && (
              <div className="mt-3 space-y-2">
                {mileagePlan.map((row) => {
                  const miles = milesFor(row)
                  const value = row.dates.reduce((s, d) => s + miles * irsMileageRate(d), 0)
                  return (
                    <div
                      key={row.projectId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white rounded-lg px-3 py-2"
                      style={{ border: '1px solid var(--color-border)' }}
                    >
                      <span className="text-sm font-medium flex-1 min-w-[140px]" style={{ color: 'var(--color-navy)' }}>
                        {projectName(row.projectId)}
                        <span className="font-normal opacity-60"> · {row.dates.length} day{row.dates.length === 1 ? '' : 's'}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          inputMode="decimal"
                          value={milesBoxValue(row)}
                          onChange={(e) => setMileageMiles((prev) => ({ ...prev, [row.projectId]: e.target.value }))}
                          placeholder="miles"
                          className="w-20 px-2 py-1.5 text-sm rounded-lg text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            border: `1px solid ${miles > 0 ? 'var(--color-border)' : '#f59e0b'}`,
                            color: 'var(--color-navy)',
                          }}
                        />
                        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>mi/day</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums w-20 text-right" style={{ color: miles > 0 ? 'var(--color-navy)' : '#b45309' }}>
                        {miles > 0 ? fmtCents(value) : 'skipped'}
                      </span>
                    </div>
                  )
                })}

                {mileageTotals.missing > 0 && (
                  <p className="text-xs flex items-start gap-1.5" style={{ color: '#b45309' }}>
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {mileageTotals.missing} project{mileageTotals.missing === 1 ? ' has' : 's have'} no distance on
                    file. Enter the one-way miles to claim {mileageTotals.missing === 1 ? 'it' : 'them'}, or leave
                    blank and {mileageTotals.missing === 1 ? 'it is' : 'they are'} skipped.
                  </p>
                )}
                {(mileageSkipped.covered > 0 || mileageSkipped.unassigned > 0) && (
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    Not listed:
                    {mileageSkipped.covered > 0 && ` ${mileageSkipped.covered} project day${mileageSkipped.covered === 1 ? '' : 's'} already claimed`}
                    {mileageSkipped.covered > 0 && mileageSkipped.unassigned > 0 && ','}
                    {mileageSkipped.unassigned > 0 && ` ${mileageSkipped.unassigned} day${mileageSkipped.unassigned === 1 ? '' : 's'} with nobody on a project`}
                    .
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {weekEntries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CalendarDays className="w-9 h-9 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-400">Nothing scheduled this week. Assign a crew above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Employee</th>
                  {days.map((d, i) => (
                    <th key={d} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>
                      {DAY_LABELS[i]}<span className="font-normal opacity-60"> {d.slice(8)}</span>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Hrs</th>
                </tr>
              </thead>
              <tbody>
                {employees
                  .filter((emp) => weekEntries.some((e) => e.employee_id === emp.id))
                  .map((emp) => {
                    const empHours = weekEntries
                      .filter((e) => e.employee_id === emp.id)
                      .reduce((s, e) => s + Number(e.planned_hours || 0), 0)
                    return (
                      <tr key={emp.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td className="px-4 py-2 text-sm font-medium whitespace-nowrap" style={{ color: 'var(--color-navy)' }}>
                          {emp.name}
                          {isInactive(emp.id) && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-normal"
                              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>inactive</span>
                          )}
                        </td>
                        {days.map((d) => {
                          const cell = cellEntries(emp.id, d)
                          return (
                            <td key={d} className="px-3 py-2 align-top">
                              {cell.length === 0 ? (
                                <span className="text-xs" style={{ color: 'var(--color-border)' }}>—</span>
                              ) : cell.map((e) => (
                                <div
                                  key={e.id}
                                  className="mb-1 last:mb-0 rounded px-2 py-1 group"
                                  style={e.status === 'approved' ? { backgroundColor: '#d1fae5' } : { backgroundColor: 'var(--color-linen)' }}
                                >
                                  <div className="flex items-start gap-1">
                                    <div className="min-w-0 flex-1">
                                      <p
                                        className="text-xs font-medium truncate"
                                        style={{ color: e.status === 'approved' ? '#065f46' : 'var(--color-navy)' }}
                                        title={projectName(e.project_id)}
                                      >
                                        {projectName(e.project_id)}
                                      </p>
                                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                                        {Number(e.planned_hours).toFixed(1)}h{e.status === 'approved' ? ' · approved' : ''}
                                      </p>
                                    </div>
                                    {e.status === 'scheduled' && (
                                      <button
                                        onClick={() => handleRemove(e)}
                                        title="Remove"
                                        className="opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                                        style={{ color: '#dc2626' }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2 text-sm text-right font-semibold whitespace-nowrap" style={{ color: 'var(--color-navy)' }}>
                          {empHours.toFixed(1)}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}

        {approved.length > 0 && (
          <div className="px-6 py-3" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: '#f0fdf4' }}>
            <p className="text-xs" style={{ color: '#065f46' }}>
              {approved.length} day{approved.length === 1 ? '' : 's'} already approved and showing in Labor Hours.
              Labor becomes cost only once payroll is run for the week — the dashboard flags hours still waiting.
            </p>
          </div>
        )}
      </div>
      </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div
              className="px-6 py-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  End-of-Week Payroll — Sat {weekStart.slice(5)} to Fri {weekEnd.slice(5)}
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  Every scheduled and approved day priced at each person&apos;s own rate. A projection of what the week
                  will cost, not a balance owed.
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-3xl font-bold" style={{ color: '#dc2626' }}>{fmtCents(projectedTotal)}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  {plannedHours.toFixed(1)} hours · {payrollPreview.length} {payrollPreview.length === 1 ? 'person' : 'people'}
                </p>
              </div>
            </div>

            {payrollPreview.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm text-gray-400">Nothing scheduled this week, so there is nothing to pay.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                    <tr>
                      {['Employee', 'Rate', 'Scheduled', 'Approved', 'Total Hrs', 'Amount', 'Payroll Run'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}
                          style={{ color: 'var(--color-navy)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payrollPreview.map((r) => (
                      <tr key={r.emp.id} style={{ borderTop: '1px solid var(--color-border)' }} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap" style={{ color: 'var(--color-navy)' }}>
                          {r.emp.name}
                          {isInactive(r.emp.id) && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-normal"
                              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right" style={{ color: 'var(--color-muted)' }}>{fmtCents(r.emp.hourly_rate)}</td>
                        <td className="px-4 py-2.5 text-sm text-right" style={{ color: 'var(--color-muted)' }}>{r.scheduledHours.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-sm text-right" style={{ color: r.approvedHours > 0 ? '#065f46' : 'var(--color-muted)' }}>{r.approvedHours.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium" style={{ color: 'var(--color-navy)' }}>{r.hours.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold" style={{ color: '#dc2626' }}>{fmtCents(r.amount)}</td>
                        <td className="px-4 py-2.5 text-sm text-right" style={{ color: 'var(--color-muted)' }}>
                          {r.recorded > 0 ? fmtCents(r.recorded) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: 'var(--color-linen)', borderTop: '2px solid var(--color-border)' }}>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-navy)' }}>TOTAL</td>
                      <td />
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: 'var(--color-navy)' }}>
                        {payrollPreview.reduce((s2, r) => s2 + r.scheduledHours, 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: 'var(--color-navy)' }}>
                        {payrollPreview.reduce((s2, r) => s2 + r.approvedHours, 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold" style={{ color: 'var(--color-navy)' }}>{plannedHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-base text-right font-bold" style={{ color: '#dc2626' }}>{fmtCents(projectedTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: 'var(--color-muted)' }}>
                        {recordedTotal > 0 ? fmtCents(recordedTotal) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {payrollPreview.length > 0 && (
            <div
              className="rounded-lg px-4 py-3"
              style={notYetRun > 0.005
                ? { backgroundColor: '#fef3c7', border: '1px solid #fcd34d' }
                : { backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' }}
            >
              <p className="text-sm font-medium" style={{ color: notYetRun > 0.005 ? '#92400e' : '#065f46' }}>
                {notYetRun > 0.005
                  ? `${fmtCents(notYetRun)} of this week is not yet in payroll`
                  : 'Payroll for this week matches the schedule'}
              </p>
              <p className="text-xs mt-1" style={{ color: notYetRun > 0.005 ? '#92400e' : '#065f46' }}>
                {notYetRun > 0.005
                  ? 'Approve the week to create labor hours, then run payroll for it. Until payroll runs, none of this reaches the P&L or the tax estimate.'
                  : 'The payroll table holds the full amount for these days, so it is costed in the P&L.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
