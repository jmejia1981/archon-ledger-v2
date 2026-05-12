'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard,
  Folder,
  Users,
  FileText,
  DollarSign,
  Clock,
  Navigation,
  TrendingUp,
  CreditCard,
  Clock3,
  BarChart3,
  Settings,
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  Zap,
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setUser(user)
      setLoading(false)

      // Fetch notifications for this user
      fetchNotifications(user.id)
    }

    checkAuth()
  }, [router, supabase])

  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      setNotifications(data || [])
      const unread = (data || []).filter((n) => !n.is_read).length
      setUnreadCount(unread)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (!error) {
        setNotifications(
          notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        )
        setUnreadCount(Math.max(0, unreadCount - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [notificationsOpen])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Folder, label: 'Projects', href: '/dashboard/projects' },
    { icon: Users, label: 'Clients', href: '/dashboard/clients' },
    { icon: Users, label: 'Employees', href: '/dashboard/employees' },
    { icon: FileText, label: 'Expenses', href: '/dashboard/expenses' },
    { icon: FileText, label: 'Proposals', href: '/dashboard/proposals' },
    { icon: DollarSign, label: 'Invoices', href: '/dashboard/invoices' },
    { icon: TrendingUp, label: 'Receivables', href: '/dashboard/receivables' },
    { icon: CreditCard, label: 'Payroll', href: '/dashboard/payroll' },
    { icon: Clock3, label: 'Labor Hours', href: '/dashboard/labor' },
    { icon: Navigation, label: 'Mileage', href: '/dashboard/mileage' },
    { icon: BarChart3, label: 'Reports', href: '/dashboard/reports' },
    { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
    { icon: Zap, label: 'Automation', href: '/dashboard/automation' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  ]

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-linen)' }}>
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 shadow-lg flex-col" style={{ backgroundColor: 'var(--color-linen)' }}>
        {/* Logo */}
        <div className="border-b flex items-center justify-center" style={{ borderColor: 'var(--color-border)', backgroundColor: '#C8B89A', padding: '1.1875rem' }}>
          <Image
            src="/images/logo-website.png"
            alt="Archon Logo"
            width={150}
            height={60}
            priority
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2 rounded-full text-sm transition-all"
                style={{
                  color: '#1A3A6B',
                  backgroundColor: isActive ? '#C8B89A' : 'transparent',
                }}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Sidebar - Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-64 shadow-lg flex flex-col z-40 lg:hidden transform transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ backgroundColor: 'var(--color-linen)' }}>
        {/* Mobile Close Button */}
        <div className="flex justify-between items-center border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: '#C8B89A', padding: '1.1875rem' }}>
          <Image
            src="/images/logo-website.png"
            alt="Archon Logo"
            width={120}
            height={48}
            priority
            style={{ objectFit: 'contain' }}
          />
          <button onClick={() => setSidebarOpen(false)} className="p-2">
            <X className="w-5 h-5" style={{ color: 'var(--color-navy)' }} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2 rounded-full text-sm transition-all"
                style={{
                  color: '#1A3A6B',
                  backgroundColor: isActive ? '#C8B89A' : 'transparent',
                }}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white px-4 md:px-8 py-4 flex items-center justify-between gap-4" style={{ borderBottom: `1px solid var(--color-border)` }}>
          {/* Mobile Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2"
            style={{ color: 'var(--color-navy)' }}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--color-muted)' }} />
              <input
                type="text"
                placeholder="Search projects, clients, invoices..."
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  border: `1px solid var(--color-border)`,
                  backgroundColor: 'white',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200, 184, 154, 0.1)'
                  e.currentTarget.style.borderColor = 'var(--color-gold)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                }}
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 md:gap-6 md:ml-8">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative hover:opacity-75 transition"
              >
                <Bell className="w-6 h-6" style={{ color: 'var(--color-muted)' }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: 'var(--color-warning)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg z-50"
                  style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}
                >
                  <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="font-semibold" style={{ color: 'var(--color-navy)' }}>Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-gray-500">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="p-4 border-b hover:bg-gray-50 transition cursor-pointer"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: !notification.is_read ? '#f5f5f5' : 'transparent' }}
                          onClick={() => markNotificationAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                              style={{
                                backgroundColor: notification.type === 'error' ? '#dc2626' : notification.type === 'warning' ? '#f59e0b' : notification.type === 'success' ? '#10b981' : 'var(--color-navy)',
                                opacity: notification.is_read ? 0 : 1,
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{notification.title}</p>
                              <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(notification.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <button
                      className="text-sm font-medium hover:opacity-75 transition"
                      style={{ color: 'var(--color-navy)' }}
                    >
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-6" style={{ borderLeft: `1px solid var(--color-border)` }}>
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{user?.user_metadata?.full_name || 'Juan'}</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Admin</p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: 'var(--color-navy)' }}>
                {(user?.user_metadata?.full_name || 'Juan').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
