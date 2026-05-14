'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { SkeletonKPICards } from '@/app/components/skeleton-loader'
import { Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface FinancialMetrics {
  totalRevenue: number; totalCollected: number; totalExpenses: number
  directCosts: number; laborCosts: number; overhead: number
  grossProfit: number; netProfit: number; profitMargin: number
}

interface PLLine { label: string; amount: number; indent?: boolean; bold?: boolean; separator?: boolean }
interface BSLine  { label: string; amount: number; indent?: boolean; bold?: boolean; separator?: boolean }

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalRevenue: 0, totalCollected: 0, totalExpenses: 0,
    directCosts: 0, laborCosts: 0, overhead: 0,
    grossProfit: 0, netProfit: 0, profitMargin: 0,
  })
  const [plLines, setPlLines]   = useState<PLLine[]>([])
  const [bsLines, setBsLines]   = useState<BSLine[]>([])
  const [taxBreakdown, setTaxBreakdown] = useState<{ category: string; amount: number }[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectDistribution, setProjectDistribution] = useState<any[]>([])
  const [laborByDept, setLaborByDept] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [yearEndYear, setYearEndYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })
  const supabase = createClient()

  useEffect(() => {
    const loadReportsData = async () => {
      try {
        const [expensesRes, invoicesRes, laborRes, projectsRes, employeesRes] = await Promise.all([
          supabase.from('expenses').select('*'),
          supabase.from('invoices').select('*'),
          supabase.from('labor_entries').select('*'),
          supabase.from('projects').select('*'),
          supabase.from('employees').select('id, name, hourly_rate, department'),
        ])

        let expenses = expensesRes.data || []
        let invoices = invoicesRes.data || []
        const laborEntries = laborRes.data || []
        const projects = projectsRes.data || []
        const employees = employeesRes.data || []

        const startDate = new Date(dateRange.startDate)
        const endDate   = new Date(dateRange.endDate)
        endDate.setHours(23, 59, 59, 999)

        invoices = invoices.filter(inv => {
          const d = new Date(inv.invoice_date || inv.created_at)
          return d >= startDate && d <= endDate
        })
        expenses = expenses.filter(exp => {
          const d = new Date(exp.date || exp.created_at)
          return d >= startDate && d <= endDate
        })

        // ── Revenue ──────────────────────────────────────────────────────────
        const totalRevenue  = invoices.reduce((s: number, inv: any) => s + (inv.invoice_amount || inv.amount || 0), 0)
        const totalCollected = invoices.reduce((s: number, inv: any) => s + (inv.amount_paid || 0), 0)
        const accountsReceivable = totalRevenue - totalCollected

        // ── Direct costs (COGS) ───────────────────────────────────────────────
        const directExpenses = expenses.filter((e: any) => e.category_group === 'direct-project-costs')
        const directByCategory: Record<string, number> = {}
        directExpenses.forEach((e: any) => {
          const cat = e.category || 'Other'
          directByCategory[cat] = (directByCategory[cat] || 0) + (e.amount || 0)
        })
        const directCosts = directExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)

        // ── Labor ─────────────────────────────────────────────────────────────
        const laborCosts = laborEntries.reduce((s: number, entry: any) => {
          const emp = employees.find((e: any) => e.id === entry.employee_id)
          const rate = emp?.hourly_rate || 0
          return s + (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5
        }, 0)

        // ── Overhead ──────────────────────────────────────────────────────────
        const overheadExpenses = expenses.filter((e: any) => e.category_group === 'company-overhead')
        const overheadByCategory: Record<string, number> = {}
        overheadExpenses.forEach((e: any) => {
          const cat = e.category || 'Other'
          overheadByCategory[cat] = (overheadByCategory[cat] || 0) + (e.amount || 0)
        })
        const overhead = overheadExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)

        const totalExpenses = directCosts + laborCosts + overhead
        const grossProfit   = totalRevenue - directCosts - laborCosts
        const netProfit     = grossProfit - overhead
        const profitMargin  = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

        // ── Tax category breakdown ────────────────────────────────────────────
        const taxMap: Record<string, number> = {}
        expenses.forEach((e: any) => {
          if (e.tax_category) {
            taxMap[e.tax_category] = (taxMap[e.tax_category] || 0) + (e.amount || 0)
          }
        })
        setTaxBreakdown(
          Object.entries(taxMap)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
        )

        // ── P&L lines ─────────────────────────────────────────────────────────
        const pl: PLLine[] = [
          { label: 'REVENUE', amount: 0, bold: true },
          { label: 'Total Invoiced', amount: totalRevenue, indent: true },
          { label: 'Total Collected', amount: totalCollected, indent: true },
          { label: 'Gross Revenue', amount: totalRevenue, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'COST OF GOODS SOLD', amount: 0, bold: true },
          ...Object.entries(directByCategory).map(([label, amount]) => ({ label, amount, indent: true })),
          { label: 'Labor Costs', amount: laborCosts, indent: true },
          { label: 'Total COGS', amount: directCosts + laborCosts, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'GROSS PROFIT', amount: grossProfit, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'OPERATING EXPENSES', amount: 0, bold: true },
          ...Object.entries(overheadByCategory).map(([label, amount]) => ({ label, amount, indent: true })),
          { label: 'Total Operating Expenses', amount: overhead, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'NET INCOME', amount: netProfit, bold: true },
        ]
        setPlLines(pl)

        // ── Balance sheet lines ───────────────────────────────────────────────
        const totalAssets = totalCollected + accountsReceivable
        const totalLiabilities = overhead  // simplified: unpaid overhead as payable
        const equity = totalAssets - totalLiabilities

        const bs: BSLine[] = [
          { label: 'ASSETS', amount: 0, bold: true },
          { label: 'Cash / Revenue Collected', amount: totalCollected, indent: true },
          { label: 'Accounts Receivable', amount: accountsReceivable, indent: true },
          { label: 'Total Assets', amount: totalAssets, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'LIABILITIES', amount: 0, bold: true },
          { label: 'Accounts Payable (Overhead)', amount: totalLiabilities, indent: true },
          { label: 'Total Liabilities', amount: totalLiabilities, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'EQUITY', amount: 0, bold: true },
          { label: 'Retained Earnings', amount: equity, indent: true },
          { label: 'Total Equity', amount: equity, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'TOTAL LIABILITIES & EQUITY', amount: totalLiabilities + equity, bold: true },
        ]
        setBsLines(bs)

        // ── Monthly chart data ────────────────────────────────────────────────
        const monthlyObj: Record<string, any> = {}
        invoices.forEach((inv: any) => {
          const key = new Date(inv.invoice_date || inv.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[key]) monthlyObj[key] = { month: key, revenue: 0, expenses: 0 }
          monthlyObj[key].revenue += inv.invoice_amount || inv.amount || 0
        })
        expenses.forEach((exp: any) => {
          const key = new Date(exp.date || exp.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[key]) monthlyObj[key] = { month: key, revenue: 0, expenses: 0 }
          monthlyObj[key].expenses += exp.amount || 0
        })
        setMonthlyData(Object.values(monthlyObj).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()))

        const projDist = projects.map((p: any) => ({
          name: p.project_name,
          value: invoices.filter((inv: any) => inv.project_id === p.id).reduce((s: number, inv: any) => s + (inv.invoice_amount || inv.amount || 0), 0),
        })).filter((p: any) => p.value > 0)
        setProjectDistribution(projDist)

        const deptLabor: Record<string, any> = {}
        laborEntries.forEach((entry: any) => {
          const emp = employees.find((e: any) => e.id === entry.employee_id)
          const dept = emp?.department || 'General', rate = emp?.hourly_rate || 0
          const cost = (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5
          if (!deptLabor[dept]) deptLabor[dept] = { name: dept, value: 0 }
          deptLabor[dept].value += cost
        })
        setLaborByDept(Object.values(deptLabor))

        setMetrics({ totalRevenue, totalCollected, totalExpenses, directCosts, laborCosts, overhead, grossProfit, netProfit, profitMargin })
      } catch (error) { console.error('Error:', error) }
      finally { setLoading(false) }
    }
    loadReportsData()
  }, [dateRange])

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  const COLORS = ['#1A3A6B', '#C8B89A', '#8B9A7D', '#D4A574']

  const exportYearEndPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(26, 58, 107)
    doc.text('Archon Construction LLC', pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(12)
    doc.text(`Year-End Financial Package — ${yearEndYear}`, pageWidth / 2, y, { align: 'center' })
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth / 2, y, { align: 'center' })
    y += 10

    // P&L
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(26, 58, 107)
    doc.text('Profit & Loss Statement', margin, y)
    y += 2
    doc.setDrawColor(200, 184, 154)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: plLines
        .filter((l) => !l.separator && l.label)
        .map((l) => [
          { content: l.label, styles: { fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: l.indent ? 8 : 3, top: 2, bottom: 2, right: 3 } } },
          { content: l.amount !== 0 || l.bold ? fmt(l.amount) : '', styles: { halign: 'right', fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: 3, top: 2, bottom: 2, right: 3 } } },
        ]),
      bodyStyles: { fontSize: 9, textColor: [33, 47, 61] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50 } },
      theme: 'plain',
    })
    y = (doc as any).lastAutoTable.finalY + 12

    if (y > 240) { doc.addPage(); y = 20 }

    // Balance Sheet
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(26, 58, 107)
    doc.text('Balance Sheet', margin, y)
    y += 2
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: bsLines
        .filter((l) => !l.separator && l.label)
        .map((l) => [
          { content: l.label, styles: { fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: l.indent ? 8 : 3, top: 2, bottom: 2, right: 3 } } },
          { content: l.amount !== 0 || l.bold ? fmt(l.amount) : '', styles: { halign: 'right', fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: 3, top: 2, bottom: 2, right: 3 } } },
        ]),
      bodyStyles: { fontSize: 9, textColor: [33, 47, 61] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50 } },
      theme: 'plain',
    })
    y = (doc as any).lastAutoTable.finalY + 12

    if (y > 220) { doc.addPage(); y = 20 }

    // Schedule C
    if (taxBreakdown.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(26, 58, 107)
      doc.text('Schedule C Expense Summary', margin, y)
      y += 2
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      const total = taxBreakdown.reduce((s, r) => s + r.amount, 0)
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Category', 'Amount', '% of Total']],
        body: [
          ...taxBreakdown.map((r) => [r.category, fmt(r.amount), `${total > 0 ? ((r.amount / total) * 100).toFixed(1) : 0}%`]),
          ['Total', fmt(total), '100%'],
        ],
        headStyles: { fillColor: [200, 184, 154], textColor: [33, 47, 61], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        theme: 'grid',
      })
    }

    // Footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Archon Construction LLC  ·  ${yearEndYear} Year-End Package  ·  Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
    }

    doc.save(`archon-year-end-${yearEndYear}.pdf`)
  }

  const exportScheduleC_CSV = () => {
    const rows = [
      ['IRS Schedule C Category', 'Amount', '% of Total Expenses'],
      ...taxBreakdown.map((r) => {
        const total = taxBreakdown.reduce((s, t) => s + t.amount, 0)
        return [r.category, r.amount.toFixed(2), `${total > 0 ? ((r.amount / total) * 100).toFixed(1) : 0}%`]
      }),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule-c-${yearEndYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPL_CSV = () => {
    const rows = [
      ['Line Item', 'Amount'],
      ...plLines
        .filter((l) => !l.separator && l.label)
        .map((l) => [l.label, l.amount !== 0 || l.bold ? l.amount.toFixed(2) : '']),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profit-loss-${yearEndYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const StatementLine = ({ line }: { line: PLLine | BSLine }) => {
    if (line.separator) return <tr><td colSpan={2} className="py-1"><hr style={{ borderColor: '#e5e7eb' }} /></td></tr>
    if (!line.label) return null
    return (
      <tr className={line.bold ? 'bg-gray-50' : 'hover:bg-gray-50'}>
        <td className={`py-2 text-sm ${line.indent ? 'pl-8' : 'pl-4'} ${line.bold ? 'font-semibold' : ''}`} style={{ color: line.bold ? '#1A3A6B' : '#374151' }}>
          {line.label}
        </td>
        <td className={`py-2 pr-4 text-sm text-right ${line.bold ? 'font-semibold' : ''}`} style={{ color: line.amount < 0 ? '#dc2626' : '#1A3A6B' }}>
          {line.amount !== 0 || line.bold ? fmt(line.amount) : ''}
        </td>
      </tr>
    )
  }

  if (loading) return (
    <div className="space-y-6 p-8">
      <h1 className="text-3xl font-bold" style={{ color: '#1A3A6B' }}>Reports</h1>
      <SkeletonKPICards />
    </div>
  )

  const tabs = ['Overview', 'P&L', 'Balance Sheet', 'Tax Summary', 'Year-End']

  return (
    <div className="space-y-6" style={{ backgroundColor: '#F5F5F5', padding: '32px' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1A3A6B' }}>Reports</h1>
          <p className="text-sm text-gray-500">Financial statements and analytics</p>
        </div>
        <div className="flex gap-2 items-center">
          <input id="report-start" name="startDate" type="date" value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }} />
          <span className="text-sm text-gray-500">to</span>
          <input id="report-end" name="endDate" type="date" value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }} />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(metrics.totalRevenue) },
          { label: 'Gross Profit', value: fmt(metrics.grossProfit), color: metrics.grossProfit >= 0 ? '#059669' : '#dc2626' },
          { label: 'Net Income', value: fmt(metrics.netProfit), color: metrics.netProfit >= 0 ? '#059669' : '#dc2626' },
          { label: 'Profit Margin', value: `${metrics.profitMargin.toFixed(1)}%`, color: metrics.profitMargin >= 0 ? '#059669' : '#dc2626' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-lg p-5 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color || '#1A3A6B' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: '#E0E0E0' }}>
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
            className="px-2 py-3 text-sm font-medium whitespace-nowrap"
            style={{ color: activeTab === tab.toLowerCase() ? '#1A3A6B' : '#999', borderBottom: activeTab === tab.toLowerCase() ? '2px solid #1A3A6B' : 'none' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: '#1A3A6B' }}>Revenue vs Expenses</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1A3A6B" stopOpacity={0.1} /><stop offset="95%" stopColor="#1A3A6B" stopOpacity={0} /></linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D4A574" stopOpacity={0.1} /><stop offset="95%" stopColor="#D4A574" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: number) => fmt(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#1A3A6B" strokeWidth={2} fill="url(#colorRev)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#D4A574" strokeWidth={2} fill="url(#colorExp)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded"><p className="text-gray-400">No data for selected period</p></div>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
              <h3 className="text-base font-semibold mb-4" style={{ color: '#1A3A6B' }}>Revenue by Project</h3>
              {projectDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={projectDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {projectDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[220px] flex items-center justify-center bg-gray-50 rounded"><p className="text-gray-400">No project data</p></div>}
            </div>
            <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
              <h3 className="text-base font-semibold mb-4" style={{ color: '#1A3A6B' }}>Labor by Department</h3>
              {laborByDept.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={laborByDept} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} /><Tooltip formatter={(v: number) => fmt(v)} /><Bar dataKey="value" fill="#1A3A6B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[220px] flex items-center justify-center bg-gray-50 rounded"><p className="text-gray-400">No labor data</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* ── P&L ── */}
      {activeTab === 'p&l' && (
        <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
            <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Profit & Loss Statement</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(dateRange.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} —{' '}
              {new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <table className="w-full">
            <tbody>
              {plLines.map((line, i) => <StatementLine key={i} line={line} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Balance Sheet ── */}
      {activeTab === 'balance sheet' && (
        <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
            <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Balance Sheet</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              As of {new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-xs text-gray-400 mt-1">Simplified — based on invoices and expenses recorded in this system</p>
          </div>
          <table className="w-full">
            <tbody>
              {bsLines.map((line, i) => <StatementLine key={i} line={line} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Year-End Package ── */}
      {activeTab === 'year-end' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Year-End Accountant Package</h2>
              <p className="text-xs text-gray-500 mt-0.5">Export everything your accountant needs in one click</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={yearEndYear} onChange={(e) => setYearEndYear(parseInt(e.target.value))}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Full Year-End PDF', sub: 'P&L + Balance Sheet + Schedule C', action: exportYearEndPDF, color: '#1A3A6B' },
              { label: 'P&L Spreadsheet', sub: 'Profit & Loss as CSV', action: exportPL_CSV, color: '#059669' },
              { label: 'Schedule C CSV', sub: 'IRS expense categories', action: exportScheduleC_CSV, color: '#7c3aed' },
            ].map(({ label, sub, action, color }) => (
              <button key={label} onClick={action}
                className="flex items-center gap-4 p-5 rounded-xl text-left hover:opacity-90 transition-opacity"
                style={{ backgroundColor: color, color: 'white' }}>
                <Download className="w-8 h-8 flex-shrink-0 opacity-80" />
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Checklist */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#1A3A6B' }}>Year-End Checklist for Your Accountant</h3>
            </div>
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {[
                { label: 'Profit & Loss Statement', detail: 'Full year revenue and expenses', done: plLines.length > 0, action: 'In Reports → P&L tab' },
                { label: 'Balance Sheet', detail: 'Assets, liabilities, and equity as of Dec 31', done: bsLines.length > 0, action: 'In Reports → Balance Sheet tab' },
                { label: 'Schedule C Expense Summary', detail: 'All expenses sorted by IRS line item', done: taxBreakdown.length > 0, action: taxBreakdown.length === 0 ? 'Add tax categories to expenses first' : 'Export above' },
                { label: '1099-NEC Filing', detail: 'Vendors/subs paid $600+ (non-incorporated)', done: false, action: 'Go to 1099 page in sidebar' },
                { label: 'Fixed Asset & Depreciation Schedule', detail: 'Equipment purchases and Section 179 elections', done: false, action: 'Go to Fixed Assets page in sidebar' },
                { label: 'Mileage Log', detail: 'Business miles driven during the year', done: false, action: 'Export from Mileage page' },
                { label: 'Payroll Summary', detail: 'W-2s for employees, 1099-NECs for subs', done: false, action: 'From Payroll page' },
                { label: 'Bank Statements', detail: 'December 31 bank balance for reconciliation', done: false, action: 'From your bank — not tracked here' },
              ].map(({ label, detail, done, action }) => (
                <div key={label} className="flex items-start gap-4 px-6 py-4">
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: done ? '#d1fae5' : '#f3f4f6' }}>
                    {done && <span style={{ color: '#059669', fontSize: 10 }}>✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#1A3A6B' }}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
                  </div>
                  <p className="text-xs text-right flex-shrink-0" style={{ color: done ? '#059669' : '#6b7280' }}>{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tax Summary ── */}
      {activeTab === 'tax summary' && (
        <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
            <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Tax Category Summary (Schedule C)</h2>
            <p className="text-xs text-gray-500 mt-0.5">Expenses grouped by IRS Schedule C line item</p>
          </div>
          {taxBreakdown.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No expenses have been assigned a tax category yet. Add tax categories in the Expenses page.
            </div>
          ) : (
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: '#1A3A6B' }}>Schedule C Category</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#1A3A6B' }}>Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#1A3A6B' }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {taxBreakdown.map((row, i) => {
                  const total = taxBreakdown.reduce((s, r) => s + r.amount, 0)
                  return (
                    <tr key={i} className="border-t hover:bg-gray-50" style={{ borderColor: '#f3f4f6' }}>
                      <td className="px-6 py-3 text-sm" style={{ color: '#374151' }}>{row.category}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium" style={{ color: '#1A3A6B' }}>{fmt(row.amount)}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-500">{total > 0 ? ((row.amount / total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  )
                })}
                <tr className="border-t bg-gray-50" style={{ borderColor: '#e5e7eb' }}>
                  <td className="px-6 py-3 text-sm font-semibold" style={{ color: '#1A3A6B' }}>Total Categorized Expenses</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold" style={{ color: '#1A3A6B' }}>{fmt(taxBreakdown.reduce((s, r) => s + r.amount, 0))}</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold text-gray-500">100%</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
