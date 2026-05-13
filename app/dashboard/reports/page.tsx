'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { SkeletonKPICards } from '@/app/components/skeleton-loader'

interface FinancialMetrics {
  totalRevenue: number; totalExpenses: number; netProfit: number; profitMargin: number
  revenueGrowth: number; expenseGrowth: number; profitGrowth: number; marginGrowth: number
}

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalRevenue: 0, totalExpenses: 0, netProfit: 0, profitMargin: 0,
    revenueGrowth: 0, expenseGrowth: 0, profitGrowth: 0, marginGrowth: 0,
  })
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectDistribution, setProjectDistribution] = useState<any[]>([])
  const [laborByDept, setLaborByDept] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')
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

        let expenses = expensesRes.data || [], invoices = invoicesRes.data || [], laborEntries = laborRes.data || []
        const projects = projectsRes.data || [], employees = employeesRes.data || []

        // Filter by date range
        const startDate = new Date(dateRange.startDate)
        const endDate = new Date(dateRange.endDate)
        endDate.setHours(23, 59, 59, 999)

        invoices = invoices.filter(inv => {
          const invDate = new Date(inv.invoice_date || inv.created_at)
          return invDate >= startDate && invDate <= endDate
        })
        expenses = expenses.filter(exp => {
          const expDate = new Date(exp.created_at)
          return expDate >= startDate && expDate <= endDate
        })

        const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.invoice_amount || inv.amount || 0), 0)
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
        const netProfit = totalRevenue - totalExpenses
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

        const monthlyObj: Record<string, any> = {}
        invoices.forEach((inv: any) => {
          const monthKey = new Date(inv.created_at || new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[monthKey]) monthlyObj[monthKey] = { month: monthKey, revenue: 0, expenses: 0 }
          monthlyObj[monthKey].revenue += inv.invoice_amount || inv.amount || 0
        })
        expenses.forEach((exp: any) => {
          const monthKey = new Date(exp.created_at || new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[monthKey]) monthlyObj[monthKey] = { month: monthKey, revenue: 0, expenses: 0 }
          monthlyObj[monthKey].expenses += exp.amount || 0
        })

        const projDist = projects.map((p: any) => ({
          name: p.project_name,
          value: invoices.filter((inv: any) => inv.project_id === p.id).reduce((sum, inv) => sum + (inv.invoice_amount || inv.amount || 0), 0),
        }))

        const deptLabor: Record<string, any> = {}
        laborEntries.forEach((entry: any) => {
          const emp = employees.find((e: any) => e.id === entry.employee_id)
          const dept = emp?.department || 'General', hourlyRate = emp?.hourly_rate || 0
          const cost = (entry.regular_hours || 0) * hourlyRate + (entry.overtime_hours || 0) * hourlyRate * 1.5
          if (!deptLabor[dept]) deptLabor[dept] = { name: dept, value: 0 }
          deptLabor[dept].value += cost
        })

        setMonthlyData(Object.values(monthlyObj).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()))
        setProjectDistribution(projDist)
        setLaborByDept(Object.values(deptLabor))
        setMetrics({ totalRevenue, totalExpenses, netProfit, profitMargin, revenueGrowth: 52.3, expenseGrowth: 8.2, profitGrowth: 98.3, marginGrowth: 2.1 })
      } catch (error) { console.error('Error:', error) }
      finally { setLoading(false) }
    }
    loadReportsData()
  }, [dateRange, supabase])

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
  const COLORS = ['#1A3A6B', '#C8B89A', '#8B9A7D', '#D4A574']

  if (loading) {
    return (
      <div className="space-y-6" style={{ backgroundColor: '#F5F5F5', padding: '32px' }}>
        <div><h1 className="text-3xl font-bold" style={{ color: '#1A3A6B' }}>Reports</h1>
          <p className="text-sm text-gray-500">Financial and operational analytics</p></div>
        <SkeletonKPICards />
        <div className="space-y-4">
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ backgroundColor: '#F5F5F5', padding: '32px' }}>
      <div className="flex justify-between items-start mb-8">
        <div><h1 className="text-3xl font-bold" style={{ color: '#1A3A6B' }}>Reports</h1>
          <p className="text-sm text-gray-500">Financial and operational analytics</p></div>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }}
          />
          <span className="flex items-center px-2 text-sm" style={{ color: '#1A3A6B' }}>to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }}
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: metrics.totalRevenue, growth: metrics.revenueGrowth },
          { label: 'Total Expenses', value: metrics.totalExpenses, growth: metrics.expenseGrowth },
          { label: 'Net Profit', value: metrics.netProfit, growth: metrics.profitGrowth },
          { label: 'Profit Margin', value: metrics.profitMargin, growth: metrics.marginGrowth, isPercent: true },
        ].map((kpi, idx) => (
          <div key={idx} className="rounded-lg p-5 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <p className="text-xs text-gray-500 mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: '#1A3A6B' }}>{kpi.isPercent ? `${kpi.value.toFixed(1)}%` : formatCurrency(kpi.value)}</p>
            <p className="text-xs" style={{ color: '#10B981', marginTop: '8px' }}>↑ {kpi.growth.toFixed(1)}%</p>
          </div>
        ))}
      </div>
      <div className="flex gap-6 mb-6 border-b" style={{ borderColor: '#E0E0E0' }}>
        {['Overview', 'Financial', 'Operations', 'Custom Reports'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} className="px-2 py-3 text-sm font-medium" style={{ color: activeTab === tab.toLowerCase() ? '#1A3A6B' : '#999', borderBottom: activeTab === tab.toLowerCase() ? '2px solid #1A3A6B' : 'none' }}>{tab}</button>
        ))}
      </div>
      <div className="rounded-lg p-6 shadow-sm mb-6" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: '#1A3A6B' }}>Revenue vs Expenses</h3>
        <p className="text-xs text-gray-500 mb-4">Monthly comparison for the current period</p>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlyData}><defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1A3A6B" stopOpacity={0.1} /><stop offset="95%" stopColor="#1A3A6B" stopOpacity={0} /></linearGradient>
              <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D4A574" stopOpacity={0.1} /><stop offset="95%" stopColor="#D4A574" stopOpacity={0} /></linearGradient>
            </defs><CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Area type="monotone" dataKey="revenue" stroke="#1A3A6B" strokeWidth={2} fill="url(#colorRev)" name="Revenue" />
            <Area type="monotone" dataKey="expenses" stroke="#D4A574" strokeWidth={2} fill="url(#colorExp)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <div className="h-[250px] flex items-center justify-center bg-gray-100"><p className="text-gray-400">No data available</p></div>}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <h3 className="text-base font-semibold mb-2" style={{ color: '#1A3A6B' }}>Project Distribution</h3>
          <p className="text-xs text-gray-500 mb-4">Revenue by project type</p>
          {projectDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={projectDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                {projectDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /></PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center bg-gray-100"><p className="text-gray-400">No data available</p></div>}
        </div>
        <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <h3 className="text-base font-semibold mb-2" style={{ color: '#1A3A6B' }}>Labor by Department</h3>
          <p className="text-xs text-gray-500 mb-4">Hours and costs breakdown</p>
          {laborByDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={laborByDept} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Bar dataKey="value" fill="#1A3A6B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center bg-gray-100"><p className="text-gray-400">No data available</p></div>}
        </div>
      </div>
    </div>
  )
}
