'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart, DollarSign, TrendingUp, Calendar } from 'lucide-react'

interface Metrics {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  activeProjects: number
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    activeProjects: 0,
  })
  const [loading, setLoading] = useState(true)
  const [, setUser] = useState<any>(null)

  const supabase = createClient()

  useEffect(() => {
    const initializePage = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          redirect('/auth/login')
        }

        setUser(user)

        // Fetch metrics
        const { data: invoices } = await supabase
          .from('invoices')
          .select('amount')
          .eq('status', 'paid')

        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')

        const { data: projects } = await supabase
          .from('projects')
          .select('*')
          .eq('status', 'active')

        const revenue = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
        const costs = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0

        setMetrics({
          totalRevenue: revenue,
          totalExpenses: costs,
          netProfit: revenue - costs,
          activeProjects: projects?.length || 0,
        })
      } catch (error) {
        console.error('Error:', error)
        redirect('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    initializePage()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="animate-pulse text-center">
          <div className="h-12 w-48 bg-blue-200 rounded-lg mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    )
  }

  const navigation = [
    {
      name: 'Projects',
      href: '/dashboard/projects',
      icon: Calendar,
      description: 'Manage construction projects',
    },
    {
      name: 'Invoices',
      href: '/dashboard/invoices',
      icon: DollarSign,
      description: 'Track client invoices',
    },
    {
      name: 'Expenses',
      href: '/dashboard/expenses',
      icon: TrendingUp,
      description: 'Log business expenses',
    },
    {
      name: 'Clients',
      href: '/dashboard/clients',
      icon: BarChart,
      description: 'Manage client data',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-playfair font-bold text-primary-900">
            Archon Ledger
          </h1>
          <button
            onClick={() => supabase.auth.signOut().then(() => redirect('/auth/login'))}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            {
              label: 'Total Revenue',
              value: `$${metrics.totalRevenue.toLocaleString()}`,
              icon: DollarSign,
              color: 'text-green-600',
            },
            {
              label: 'Total Expenses',
              value: `$${metrics.totalExpenses.toLocaleString()}`,
              icon: TrendingUp,
              color: 'text-red-600',
            },
            {
              label: 'Net Profit',
              value: `$${metrics.netProfit.toLocaleString()}`,
              icon: BarChart,
              color: 'text-blue-600',
            },
            {
              label: 'Active Projects',
              value: metrics.activeProjects.toString(),
              icon: Calendar,
              color: 'text-purple-600',
            },
          ].map((metric, idx) => {
            const Icon = metric.icon
            return (
              <div key={idx} className="bg-white rounded-lg shadow p-6 border-l-4 border-primary-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{metric.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${metric.color}`} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-lg shadow-sm hover:shadow-lg transition p-6 border border-gray-100 group"
              >
                <Icon className="w-10 h-10 text-primary-500 mb-3 group-hover:scale-110 transition" />
                <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-600 mt-2">{item.description}</p>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
