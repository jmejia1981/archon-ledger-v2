'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { TrendingUp, DollarSign, Target } from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'
import { SkeletonKPICards } from '@/app/components/skeleton-loader'

interface ProjectMetrics {
  name: string
  revenue: number
  expenses: number
  profit: number
  profitMargin: number
  status: string
}

interface ClientMetrics {
  name: string
  revenue: number
  invoices: number
  averageInvoice: number
}

export default function AnalyticsPage() {
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics[]>([])
  const [clientMetrics, setClientMetrics] = useState<ClientMetrics[]>([])
  const [cashflowData, setCashflowData] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [kpis, setKpis] = useState({
    totalProfit: 0,
    profitMargin: 0,
    profitChange: 0,
    topProject: '',
    topClient: '',
    avgProjectProfit: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const COLORS = ['#1A3A6B', '#C8B89A', '#8B9A7D', '#D4A574', '#7A8B99', '#B8A586']

  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        // Fetch all data
        const [invoicesRes, expensesRes, projectsRes, clientsRes] = await Promise.all([
          supabase.from('invoices').select('*'),
          supabase.from('expenses').select('*'),
          supabase.from('projects').select('*'),
          supabase.from('clients').select('*'),
        ])

        const invoices = invoicesRes.data || []
        const expenses = expensesRes.data || []
        const projects = projectsRes.data || []
        const clients = clientsRes.data || []

        // Calculate project metrics
        const projMetrics = projects.map((proj) => {
          const projInvoices = invoices.filter((inv) => inv.project_id === proj.id)
          const projExpenses = expenses.filter((exp) => exp.project_id === proj.id)

          const revenue = projInvoices.reduce((sum, inv) => sum + (inv.invoice_amount || 0), 0)
          const expenseAmount = projExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
          const profit = revenue - expenseAmount
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0

          return {
            name: proj.project_name,
            revenue,
            expenses: expenseAmount,
            profit,
            profitMargin,
            status: proj.status || 'active',
          }
        })

        // Calculate client metrics
        const clientMetricsData = clients.map((client) => {
          const clientInvoices = invoices.filter((inv) => inv.client_id === client.id)
          const revenue = clientInvoices.reduce((sum, inv) => sum + (inv.invoice_amount || 0), 0)

          return {
            name: client.name,
            revenue,
            invoices: clientInvoices.length,
            averageInvoice: clientInvoices.length > 0 ? revenue / clientInvoices.length : 0,
          }
        })

        // Calculate cashflow (monthly)
        const cashflowObj: Record<string, any> = {}
        invoices.forEach((inv) => {
          const month = new Date(inv.invoice_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
          })
          if (!cashflowObj[month]) {
            cashflowObj[month] = { month, received: 0, pending: 0 }
          }
          cashflowObj[month].received += inv.amount_paid || 0
          const outstanding = (inv.invoice_amount || 0) - (inv.amount_paid || 0)
          cashflowObj[month].pending += outstanding
        })

        const cashflow = Object.values(cashflowObj).sort(
          (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
        )

        // Calculate trend data (profit by month)
        const trendObj: Record<string, any> = {}
        invoices.forEach((inv) => {
          const month = new Date(inv.invoice_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
          })
          if (!trendObj[month]) {
            trendObj[month] = { month, revenue: 0, expenses: 0 }
          }
          trendObj[month].revenue += inv.invoice_amount || 0
        })

        expenses.forEach((exp) => {
          const month = new Date(exp.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
          })
          if (!trendObj[month]) {
            trendObj[month] = { month, revenue: 0, expenses: 0 }
          }
          trendObj[month].expenses += exp.amount || 0
        })

        const trends = Object.values(trendObj)
          .map((t: any) => ({
            ...t,
            profit: t.revenue - t.expenses,
          }))
          .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

        // Calculate KPIs
        const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.invoice_amount || 0), 0)
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
        const totalProfit = totalRevenue - totalExpenses
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

        const topProjMetrics = projMetrics.length > 0 ? projMetrics.reduce((max, p) => (p.profit > max.profit ? p : max)) : null
        const topClientMetrics = clientMetricsData.length > 0 ? clientMetricsData.reduce((max, c) => (c.revenue > max.revenue ? c : max)) : null

        setProjectMetrics(projMetrics)
        setClientMetrics(clientMetricsData)
        setCashflowData(cashflow)
        setTrendData(trends)
        setKpis({
          totalProfit,
          profitMargin,
          profitChange: projMetrics.length > 0 ? ((projMetrics[projMetrics.length - 1]?.profit || 0) / (projMetrics[0]?.profit || 1)) * 100 - 100 : 0,
          topProject: topProjMetrics?.name || 'N/A',
          topClient: topClientMetrics?.name || 'N/A',
          avgProjectProfit: projMetrics.length > 0 ? projMetrics.reduce((sum, p) => sum + p.profit, 0) / projMetrics.length : 0,
        })
      } catch (error) {
        console.error('Error loading analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalyticsData()
  }, [supabase])

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Analytics' }]} />
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Advanced Analytics</h1>
          <p style={{ color: 'var(--color-muted)' }}>Deep dive into your business metrics and profitability</p>
        </div>
        <SkeletonKPICards />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Analytics' }]} />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Advanced Analytics</h1>
        <p style={{ color: 'var(--color-muted)' }}>Deep dive into your business metrics and profitability</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>
                Total Profit
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                {formatCurrency(kpis.totalProfit)}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>All projects combined</p>
            </div>
            <DollarSign className="w-6 h-6" style={{ color: 'var(--color-success)', opacity: 0.15 }} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>
                Profit Margin
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                {kpis.profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>Overall efficiency</p>
            </div>
            <TrendingUp className="w-6 h-6" style={{ color: 'var(--color-navy)', opacity: 0.15 }} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>
                Top Project
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                {kpis.topProject.substring(0, 20)}...
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>By profit</p>
            </div>
            <Target className="w-6 h-6" style={{ color: 'var(--color-navy)', opacity: 0.15 }} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>
                Avg Project Profit
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                {formatCurrency(kpis.avgProjectProfit)}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>Per project</p>
            </div>
            <DollarSign className="w-6 h-6" style={{ color: 'var(--color-navy)', opacity: 0.15 }} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profitability by Project */}
        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
            Profitability by Project
          </h3>
          {projectMetrics.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="revenue" fill="#1A3A6B" name="Revenue" />
                <Bar dataKey="expenses" fill="#D4A574" name="Expenses" />
                <Bar dataKey="profit" fill="#8B9A7D" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center bg-gray-100">
              <p style={{ color: 'var(--color-muted)' }}>No project data available</p>
            </div>
          )}
        </div>

        {/* Revenue by Client */}
        <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
            Revenue by Client
          </h3>
          {clientMetrics.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clientMetrics}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatCurrency(value as number)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {clientMetrics.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center bg-gray-100">
              <p style={{ color: 'var(--color-muted)' }}>No client data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Cashflow Analysis */}
      <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
          Cash Flow Analysis
        </h3>
        {cashflowData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cashflowData}>
              <defs>
                <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B9A7D" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B9A7D" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4A574" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#D4A574" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Area
                type="monotone"
                dataKey="received"
                stroke="#8B9A7D"
                fillOpacity={1}
                fill="url(#colorReceived)"
                name="Cash Received"
              />
              <Area
                type="monotone"
                dataKey="pending"
                stroke="#D4A574"
                fillOpacity={1}
                fill="url(#colorPending)"
                name="Cash Pending"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center bg-gray-100">
            <p style={{ color: 'var(--color-muted)' }}>No cashflow data available</p>
          </div>
        )}
      </div>

      {/* Profit Trend */}
      <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
          Profit Trend Over Time
        </h3>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#1A3A6B"
                strokeWidth={2}
                name="Revenue"
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="#D4A574"
                strokeWidth={2}
                name="Expenses"
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#8B9A7D"
                strokeWidth={2}
                name="Profit"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center bg-gray-100">
            <p style={{ color: 'var(--color-muted)' }}>No trend data available</p>
          </div>
        )}
      </div>

      {/* Project Details Table */}
      {projectMetrics.length > 0 && (
        <div className="bg-white rounded-lg overflow-hidden shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
              Detailed Project Metrics
            </h3>
          </div>
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Project
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Revenue
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Expenses
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Profit
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
                  Margin
                </th>
              </tr>
            </thead>
            <tbody>
              {projectMetrics.map((proj) => (
                <tr key={proj.name} style={{ borderBottom: `1px solid var(--color-border)` }}>
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>
                    {proj.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-right" style={{ color: 'var(--color-navy)' }}>
                    {formatCurrency(proj.revenue)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right" style={{ color: 'var(--color-muted)' }}>
                    {formatCurrency(proj.expenses)}
                  </td>
                  <td
                    className="px-6 py-4 text-sm font-semibold text-right"
                    style={{ color: proj.profit > 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}
                  >
                    {formatCurrency(proj.profit)}
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-right"
                    style={{ color: proj.profitMargin > 20 ? 'var(--color-success)' : 'var(--color-muted)' }}
                  >
                    {proj.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
