'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  AlertCircle,
  Clock,
  X,
  ChevronRight,
} from 'lucide-react'
import {
  RevenueChart,
  BudgetVsActualChart,
  ExpenseBreakdownChart,
  CashflowChart,
  ProfitTrendChart,
} from '@/app/dashboard/dashboard-charts'

interface DashboardMetrics {
  totalContractedRevenue: number
  revisedContractValue: number
  totalExpenses: number
  laborCosts: number
  mileageCosts: number
  totalInvoiced: number
  totalCollected: number
  accountsReceivable: number
  overdueReceivables: number
  netProfit: number
  profitMargin: number
  activeProjects: number
  activeClients: number
}

interface Project {
  id: string
  project_name: string
}

const supabase = createClient()

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalContractedRevenue: 0,
    revisedContractValue: 0,
    totalExpenses: 0,
    laborCosts: 0,
    mileageCosts: 0,
    totalInvoiced: 0,
    totalCollected: 0,
    accountsReceivable: 0,
    overdueReceivables: 0,
    netProfit: 0,
    profitMargin: 0,
    activeProjects: 0,
    activeClients: 0,
  })
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [detailModal, setDetailModal] = useState<{ title: string; rows: { label: string; value: string; sub?: string }[] } | null>(null)
  const router = useRouter()

  // Store all data for filtering
  const [allData, setAllData] = useState<any>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        console.log('Starting dashboard data load...')
        // Fetch all necessary data
        const [projectsRes, expensesRes, laborRes, mileageRes, invoicesRes, clientsRes, billsRes] = await Promise.all([
          supabase.from('projects').select('*'),
          supabase.from('expenses').select('*'),
          supabase.from('labor_entries').select('*'),
          supabase.from('mileage_entries').select('*'),
          supabase.from('invoices').select('*'),
          supabase.from('clients').select('*'),
          supabase.from('vendor_bills').select('*'),
        ])

        const employeesRes = await supabase.from('employees').select('id, name, hourly_rate')

        // Check for errors
        if (projectsRes.error) console.error('Projects error:', projectsRes.error)
        if (expensesRes.error) console.error('Expenses error:', expensesRes.error)
        if (laborRes.error) console.error('Labor error:', laborRes.error)
        if (mileageRes.error) console.error('Mileage error:', mileageRes.error)
        if (invoicesRes.error) console.error('Invoices error:', invoicesRes.error)
        if (clientsRes.error) console.error('Clients error:', clientsRes.error)
        if (employeesRes.error) console.error('Employees error:', employeesRes.error)

        // Log data to see what we're working with
        console.log('Projects:', projectsRes.data?.length, 'items')
        console.log('Expenses:', expensesRes.data?.length, 'items')
        console.log('Labor:', laborRes.data?.length, 'items')
        console.log('Mileage:', mileageRes.data?.length, 'items')
        console.log('Invoices:', invoicesRes.data?.length, 'items')
        console.log('Employees:', employeesRes.data?.length, 'items')

        const projects = projectsRes
        const expenses = expensesRes
        const labor = laborRes
        const mileage = mileageRes
        const invoices = invoicesRes
        const clients = clientsRes
        const employees = employeesRes.data || []

        // Calculate metrics
        const totalContractedRevenue =
          projects.data?.reduce((sum, p) => sum + (p.contract_budget || 0), 0) || 0
        const revisedContractValue =
          projects.data?.reduce(
            (sum, p) => sum + (p.contract_budget || 0),
            0
          ) || 0

        const billsTotal = billsRes.data?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0
        const totalExpenses = (expenses.data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0) + billsTotal
        console.log('Total expenses:', totalExpenses)

        let laborCosts = 0
        if (labor.data) {
          console.log('Calculating labor costs from entries:', labor.data.length)
          labor.data.forEach((entry: any) => {
            const empRate = employees?.find((e: any) => e.id === entry.employee_id)?.hourly_rate || 0
            const regularCost = (entry.regular_hours || 0) * empRate
            const overtimeCost = (entry.overtime_hours || 0) * empRate * 1.5
            console.log('Labor entry:', entry.employee_id, 'regular hours:', entry.regular_hours, 'overtime:', entry.overtime_hours, 'rate:', empRate, 'cost:', regularCost + overtimeCost)
            laborCosts += regularCost
            laborCosts += overtimeCost
          })
          console.log('Total labor costs calculated:', laborCosts)
        }

        let mileageCosts = 0
        if (mileage.data) {
          console.log('Calculating mileage costs from entries:', mileage.data.length)
          mileage.data.forEach((entry: any) => {
            mileageCosts += (entry.miles_driven || 0) * (entry.reimbursement_rate || 0.65)
          })
          console.log('Total mileage costs calculated:', mileageCosts)
        }

        const totalInvoiced = invoices.data?.reduce((sum, inv) => sum + (inv.invoice_amount || inv.amount || 0), 0) || 0
        const totalCollected = invoices.data?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0
        const accountsReceivable = totalInvoiced - totalCollected
        const overdueReceivables = invoices.data
          ?.filter((inv: any) => inv.status !== 'paid' && (inv.invoice_amount || inv.amount || 0) > (inv.amount_paid || 0) && (inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < new Date())))
          .reduce((sum, inv) => sum + ((inv.invoice_amount || inv.amount || 0) - (inv.amount_paid || 0)), 0) || 0

        console.log('Totals - Invoiced:', totalInvoiced, 'Collected:', totalCollected, 'Receivable:', accountsReceivable)

        const totalCosts = totalExpenses + laborCosts + mileageCosts
        const netProfit = totalInvoiced - totalCosts
        const profitMargin = totalInvoiced > 0 ? (netProfit / totalInvoiced) * 100 : 0

        const activeProjects = projects.data?.filter((p) => p.status === 'active').length || 0
        const activeClients = clients.data?.filter((c) => c.status === 'active').length || 0

        console.log('Final metrics - Revenue:', revisedContractValue, 'Costs:', totalCosts, 'Profit:', netProfit, 'Active projects:', activeProjects)

        // Aggregate data by month for charts
        const monthlyData: Record<string, any> = {}

        // Process invoices by month
        invoices.data?.forEach((inv: any) => {
          const date = new Date(inv.created_at || new Date())
          const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { month: monthKey, revenue: 0, expenses: 0, profit: 0 }
          }
          monthlyData[monthKey].revenue += inv.invoice_amount || inv.amount || 0
        })

        // Process expenses by month
        expenses.data?.forEach((exp: any) => {
          const date = new Date(exp.created_at || new Date())
          const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { month: monthKey, revenue: 0, expenses: 0, profit: 0 }
          }
          monthlyData[monthKey].expenses += exp.amount || 0
        })

        // Calculate profit
        Object.keys(monthlyData).forEach(key => {
          monthlyData[key].profit = monthlyData[key].revenue - monthlyData[key].expenses
        })

        const sortedChartData = Object.values(monthlyData).sort((a, b) =>
          new Date(a.month).getTime() - new Date(b.month).getTime()
        )

        // Store all data for filtering by project
        setAllData({
          projects: projects.data || [],
          expenses: expenses.data || [],
          bills: billsRes.data || [],
          labor: labor.data || [],
          mileage: mileage.data || [],
          invoices: invoices.data || [],
          clients: clients.data || [],
          employees: employees || [],
        })

        setProjects(projects.data || [])
        setChartData(sortedChartData)
        setMetrics({
          totalContractedRevenue,
          revisedContractValue,
          totalExpenses,
          laborCosts,
          mileageCosts,
          totalInvoiced,
          totalCollected,
          accountsReceivable,
          overdueReceivables,
          netProfit,
          profitMargin,
          activeProjects,
          activeClients,
        })
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  // Recalculate metrics when project selection changes
  useEffect(() => {
    if (!allData) return

    const filterByProject = (data: any[], projectIdField: string) => {
      if (selectedProjectId === 'all') return data
      return data.filter((item: any) => item[projectIdField] === selectedProjectId)
    }

    const filteredProjects = selectedProjectId === 'all'
      ? allData.projects
      : allData.projects.filter((p: any) => p.id === selectedProjectId)

    const filteredExpenses = filterByProject(allData.expenses, 'project_id')
    const filteredBills = filterByProject(allData.bills || [], 'project_id')
    const filteredLabor = filterByProject(allData.labor, 'project_id')
    const filteredMileage = filterByProject(allData.mileage, 'project_id')
    const filteredInvoices = filterByProject(allData.invoices, 'project_id')

    // Recalculate all metrics
    const totalContractedRevenue = filteredProjects.reduce((sum: number, p: any) => sum + (p.contract_budget || 0), 0)
    const revisedContractValue = filteredProjects.reduce((sum: number, p: any) => sum + (p.contract_budget || 0), 0)
    const totalExpenses = filteredExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
      + filteredBills.reduce((sum: number, b: any) => sum + (b.amount || 0), 0)

    let laborCosts = 0
    filteredLabor.forEach((entry: any) => {
      const empRate = allData.employees?.find((e: any) => e.id === entry.employee_id)?.hourly_rate || 0
      laborCosts += (entry.regular_hours || 0) * empRate
      laborCosts += (entry.overtime_hours || 0) * empRate * 1.5
    })

    let mileageCosts = 0
    filteredMileage.forEach((entry: any) => {
      mileageCosts += (entry.miles_driven || 0) * (entry.reimbursement_rate || 0.65)
    })

    const totalInvoiced = filteredInvoices.reduce((sum: number, inv: any) => sum + (inv.invoice_amount || inv.amount || 0), 0)
    const totalCollected = filteredInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0)
    const accountsReceivable = totalInvoiced - totalCollected
    const overdueReceivables = filteredInvoices
      .filter((inv: any) => inv.status !== 'paid' && (inv.invoice_amount || inv.amount || 0) > (inv.amount_paid || 0) && (inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < new Date())))
      .reduce((sum: number, inv: any) => sum + ((inv.invoice_amount || inv.amount || 0) - (inv.amount_paid || 0)), 0)

    const totalCosts = totalExpenses + laborCosts + mileageCosts
    const netProfit = totalInvoiced - totalCosts
    const profitMargin = totalInvoiced > 0 ? (netProfit / totalInvoiced) * 100 : 0

    const activeProjects = filteredProjects.filter((p: any) => p.status === 'active').length
    const activeClients = selectedProjectId === 'all'
      ? allData.clients.filter((c: any) => c.status === 'active').length
      : 1

    setMetrics({
      totalContractedRevenue,
      revisedContractValue,
      totalExpenses,
      laborCosts,
      mileageCosts,
      totalInvoiced,
      totalCollected,
      accountsReceivable,
      overdueReceivables,
      netProfit,
      profitMargin,
      activeProjects,
      activeClients,
    })
  }, [selectedProjectId, allData])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const openDetail = (title: string, rows: { label: string; value: string; sub?: string }[]) => {
    setDetailModal({ title, rows })
  }

  const kpiCards = [
    { label: 'Total Contracted Revenue', key: 'totalContractedRevenue', icon: DollarSign, color: 'text-blue-600', href: '/dashboard/projects' },
    { label: 'Revised Contract Value', key: 'revisedContractValue', icon: TrendingUp, color: 'text-green-600', href: '/dashboard/projects' },
    { label: 'Total Expenses', key: 'totalExpenses', icon: AlertCircle, color: 'text-red-600', href: '/dashboard/expenses' },
    { label: 'Labor Costs', key: 'laborCosts', icon: Users, color: 'text-orange-600', href: '/dashboard/labor' },
    { label: 'Mileage Costs', key: 'mileageCosts', icon: Clock, color: 'text-purple-600', href: '/dashboard/mileage' },
    { label: 'Total Invoiced', key: 'totalInvoiced', icon: Briefcase, color: 'text-indigo-600', href: '/dashboard/invoices' },
    { label: 'Total Collected', key: 'totalCollected', icon: DollarSign, color: 'text-emerald-600', href: '/dashboard/payments' },
    { label: 'Accounts Receivable', key: 'accountsReceivable', icon: AlertCircle, color: 'text-yellow-600', href: '/dashboard/receivables' },
    { label: 'Overdue Receivables', key: 'overdueReceivables', icon: AlertCircle, color: 'text-red-700', href: '/dashboard/receivables' },
    {
      label: 'Net Profit', key: 'netProfit', icon: TrendingUp,
      color: metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
      onDetail: () => openDetail('Net Profit Breakdown', [
        { label: 'Total Invoiced (Revenue)', value: formatCurrency(metrics.totalInvoiced) },
        { label: 'Total Expenses', value: `− ${formatCurrency(metrics.totalExpenses)}` },
        { label: 'Labor Costs', value: `− ${formatCurrency(metrics.laborCosts)}` },
        { label: 'Mileage Costs', value: `− ${formatCurrency(metrics.mileageCosts)}` },
        { label: 'Net Profit', value: formatCurrency(metrics.netProfit), sub: `${metrics.profitMargin.toFixed(1)}% margin` },
      ]),
    },
    {
      label: 'Profit Margin %', key: 'profitMargin', icon: TrendingUp, color: 'text-cyan-600', isPercent: true,
      href: '/dashboard/reports',
    },
    { label: 'Active Projects', key: 'activeProjects', icon: Briefcase, color: 'text-slate-600', isCount: true, href: '/dashboard/projects' },
  ]

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-64 bg-gray-200 rounded"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-playfair font-bold mb-1 sm:mb-2" style={{ color: 'var(--color-navy)' }}>Dashboard</h1>
          <p style={{ color: 'var(--color-muted)' }}>Executive overview of your construction business</p>
        </div>
        <div className="w-full sm:w-72 flex-shrink-0">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
            View by Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'white', color: 'var(--color-navy)' }}
          >
            <option value="all">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon
          const metricValue = metrics[kpi.key as keyof DashboardMetrics] as number || 0
          const displayValue = kpi.isCount
            ? metricValue
            : kpi.isPercent
            ? `${metricValue.toFixed(1)}%`
            : formatCurrency(metricValue)

          const handleClick = () => {
            if ((kpi as any).onDetail) (kpi as any).onDetail()
            else if ((kpi as any).href) router.push((kpi as any).href)
          }

          return (
            <div key={idx} onClick={handleClick} className="bg-white rounded-lg p-5 shadow-sm hover:shadow-md hover:border-opacity-60 transition cursor-pointer group" style={{ border: `1px solid var(--color-border)` }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>
                    {kpi.label}
                  </p>
                  <p className={`text-2xl font-bold ${kpi.color}`} style={{ color: 'var(--color-navy)' }}>
                    {displayValue}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Icon className={`w-6 h-6 opacity-20`} style={{ color: 'var(--color-gold)' }} />
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition" style={{ color: 'var(--color-navy)' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tax Estimate */}
      <div
        onClick={() => openDetail('Estimated Taxes Breakdown', [
          { label: 'Net Profit', value: formatCurrency(metrics.netProfit) },
          { label: 'Tax Rate', value: '30%' },
          { label: 'Estimated Tax', value: formatCurrency(Math.max(metrics.netProfit * 0.3, 0)), sub: 'Set aside this amount' },
          { label: 'After-Tax Profit', value: formatCurrency(Math.max(metrics.netProfit * 0.7, 0)) },
        ])}
        className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition cursor-pointer group"
        style={{ border: `1px solid var(--color-border)` }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>Estimated Taxes</h2>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition" style={{ color: 'var(--color-navy)' }} />
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>30% of net profit — set aside for tax obligations</p>
          </div>
          <div className="sm:text-right">
            <p className="text-3xl font-bold" style={{ color: metrics.netProfit > 0 ? '#dc2626' : 'var(--color-muted)' }}>
              {formatCurrency(Math.max(metrics.netProfit * 0.3, 0))}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
              Based on {formatCurrency(metrics.netProfit)} net profit
            </p>
          </div>
        </div>
      </div>

      {/* Recurring Overhead Expenses */}
      {allData && (() => {
        const recurring = (allData.expenses || []).filter(
          (e: any) => e.is_monthly && e.category_group === 'company-overhead'
        )
        const monthlyTotal = recurring.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        return (
          <div className="bg-white rounded-lg shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>Recurring Overhead Expenses</h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>Monthly fixed costs</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-muted)' }}>Monthly Total</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{formatCurrency(monthlyTotal)}</p>
              </div>
            </div>

            {recurring.length === 0 ? (
              <div className="px-6 py-8 text-center" style={{ color: 'var(--color-muted)' }}>
                No recurring overhead expenses recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead style={{ backgroundColor: 'var(--color-linen)' }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Description</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>End Date</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-navy)' }}>Monthly</th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((e: any) => (
                    <tr key={e.id} className="border-t hover:bg-gray-50 transition" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{e.vendor}</td>
                      <td className="px-6 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{e.category}</td>
                      <td className="px-6 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{e.description}</td>
                      <td className="px-6 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                        {e.monthly_end_date
                          ? new Date(e.monthly_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                          : <span className="italic">Ongoing</span>}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-right" style={{ color: 'var(--color-navy)' }}>
                        {formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ borderTop: `2px solid var(--color-border)` }}>
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>Total / month</td>
                    <td className="px-6 py-3 text-sm font-bold text-right" style={{ color: 'var(--color-navy)' }}>{formatCurrency(monthlyTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <RevenueChart monthlyRevenueData={chartData} />
        <BudgetVsActualChart budgetVsActualData={allData ? allData.projects.map((p: any) => ({
          name: p.project_name,
          budget: p.contract_budget || 0,
          actual: (allData.expenses || []).filter((e: any) => e.project_id === p.id).reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
        })) : []} />
        <ExpenseBreakdownChart expenseCategoryData={allData ? Object.entries(
          (allData.expenses || []).reduce((acc: any, e: any) => {
            const cat = e.category || 'Other'
            acc[cat] = (acc[cat] || 0) + (e.amount || 0)
            return acc
          }, {})
        ).map(([name, value]) => ({ name, value })) : []} />
        <CashflowChart cashflowData={allData ? Object.entries(
          (allData.invoices || []).reduce((acc: any, inv: any) => {
            const date = new Date(inv.created_at || new Date())
            const weekKey = `Week ${Math.ceil(date.getDate() / 7)}`
            acc[weekKey] = (acc[weekKey] || 0) + (inv.invoice_amount || inv.amount || 0)
            return acc
          }, {})
        ).map(([name, value]) => ({ name, value })) : []} />
        <ProfitTrendChart monthlyRevenueData={chartData} />
      </div>

      {/* Widgets Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { title: 'Projects Nearing Budget Limit', count: '0' },
          { title: 'Overdue Invoices', count: '0' },
          { title: 'Pending Approvals', count: '0' },
        ].map((widget, idx) => (
          <div key={idx} className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>{widget.title}</h3>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-gold)' }}>{widget.count}</p>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-linen)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-navy)' }}>{detailModal.title}</h2>
              <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-black/10 rounded transition">
                <X className="w-5 h-5" style={{ color: 'var(--color-navy)' }} />
              </button>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {detailModal.rows.map((row, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{row.label}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{row.value}</span>
                    {row.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{row.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
