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
  Navigation,
  TrendingUp,
  CreditCard,
  Clock3,
  BarChart3,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Zap,
  Receipt,
  Package,
  ClipboardList,
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

      // If user chose not to be remembered, sign out when browser is reopened
      if (
        localStorage.getItem('archon_remember') === 'false' &&
        !sessionStorage.getItem('archon_active')
      ) {
        await supabase.auth.signOut()
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
    { icon: Receipt, label: 'Payables', href: '/dashboard/payables' },
    { icon: Package, label: 'Fixed Assets', href: '/dashboard/assets' },
    { icon: ClipboardList, label: '1099 Tracking', href: '/dashboard/1099' },
    { icon: CreditCard, label: 'Payroll', href: '/dashboard/payroll' },
    { icon: Clock3, label: 'Labor Hours', href: '/dashboard/labor' },
    { icon: Navigation, label: 'Mileage', href: '/dashboard/mileage' },
    { icon: BarChart3, label: 'Reports', href: '/dashboard/reports' },
    { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
    { icon: Zap, label: 'Automation', href: '/dashboard/automation' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  ]

  const bottomNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Folder, label: 'Projects', href: '/dashboard/projects' },
    { icon: DollarSign, label: 'Invoices', href: '/dashboard/invoices' },
    { icon: FileText, label: 'Expenses', href: '/dashboard/expenses' },
    { icon: Menu, label: 'More', href: null },
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

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={`fixed left-0 top-0 h-screen w-72 shadow-xl flex flex-col z-40 lg:hidden transform transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ backgroundColor: 'var(--color-linen)' }}>
        <div className="flex justify-between items-center border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: '#C8B89A', padding: '1.1875rem' }}>
          <Image src="/images/logo-website.png" alt="Archon Logo" width={120} height={48} priority style={{ objectFit: 'contain' }} />
          <button onClick={() => setSidebarOpen(false)} className="p-2">
            <X className="w-5 h-5" style={{ color: 'var(--color-navy)' }} />
          </button>
        </div>

        {/* User info in sidebar */}
        <div className="px-4 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: 'var(--color-navy)' }}>
            {(user?.user_metadata?.name || user?.user_metadata?.username || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{user?.user_metadata?.name || user?.user_metadata?.username || 'User'}</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Admin</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  color: '#1A3A6B',
                  backgroundColor: isActive ? '#C8B89A' : 'transparent',
                }}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign out in sidebar */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={async () => {
              sessionStorage.removeItem('archon_active')
              await supabase.auth.signOut()
              router.push('/auth/login')
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ color: 'var(--color-destructive)', backgroundColor: 'rgba(220,38,38,0.05)' }}
          >
            <X className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white px-4 md:px-8 py-3 flex items-center justify-between gap-4" style={{ borderBottom: `1px solid var(--color-border)` }}>

          {/* Mobile: logo centered + bell + avatar */}
          <div className="flex lg:hidden items-center justify-between w-full">
            <Image src="/images/logo-website.png" alt="Archon" width={100} height={40} style={{ objectFit: 'contain' }} />
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="relative hover:opacity-75 transition p-1">
                  <Bell className="w-6 h-6" style={{ color: 'var(--color-muted)' }} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: 'var(--color-warning)' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg shadow-lg z-50" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
                    <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <h3 className="font-semibold" style={{ color: 'var(--color-navy)' }}>Notifications</h3>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center"><p className="text-sm text-gray-500">No notifications yet</p></div>
                      ) : notifications.map((n) => (
                        <div key={n.id} className="p-4 border-b hover:bg-gray-50 transition cursor-pointer" style={{ borderColor: 'var(--color-border)' }} onClick={() => markNotificationAsRead(n.id)}>
                          <p className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Avatar opens sidebar */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                {(user?.user_metadata?.name || user?.user_metadata?.username || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
              </button>
            </div>
          </div>

          {/* Desktop: search + notifications + user */}
          <div className="hidden lg:flex flex-1 items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--color-muted)' }} />
                <input
                  type="text"
                  placeholder="Search projects, clients, invoices..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{ border: `1px solid var(--color-border)`, backgroundColor: 'white' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-gold)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative" ref={notificationsRef}>
                <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="relative hover:opacity-75 transition">
                  <Bell className="w-6 h-6" style={{ color: 'var(--color-muted)' }} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: 'var(--color-warning)' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg z-50" style={{ backgroundColor: 'white', border: `1px solid var(--color-border)` }}>
                    <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <h3 className="font-semibold" style={{ color: 'var(--color-navy)' }}>Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center"><p className="text-sm text-gray-500">No notifications yet</p></div>
                      ) : notifications.map((notification) => (
                        <div key={notification.id} className="p-4 border-b hover:bg-gray-50 transition cursor-pointer" style={{ borderColor: 'var(--color-border)', backgroundColor: !notification.is_read ? '#f5f5f5' : 'transparent' }} onClick={() => markNotificationAsRead(notification.id)}>
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: notification.type === 'error' ? '#dc2626' : notification.type === 'warning' ? '#f59e0b' : notification.type === 'success' ? '#10b981' : 'var(--color-navy)', opacity: notification.is_read ? 0 : 1 }} />
                            <div className="flex-1">
                              <p className="text-sm font-medium" style={{ color: 'var(--color-navy)' }}>{notification.title}</p>
                              <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{new Date(notification.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
                      <button className="text-sm font-medium hover:opacity-75 transition" style={{ color: 'var(--color-navy)' }}>View All Notifications</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pl-6" style={{ borderLeft: `1px solid var(--color-border)` }}>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{user?.user_metadata?.name || user?.user_metadata?.username || 'User'}</p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Admin</p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: 'var(--color-navy)' }}>
                  {(user?.user_metadata?.name || user?.user_metadata?.username || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 pb-20 lg:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t" style={{ backgroundColor: 'white', borderColor: 'var(--color-border)' }}>
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href ? pathname === item.href : false
            if (item.href === null) {
              return (
                <button
                  key="more"
                  onClick={() => setSidebarOpen(true)}
                  className="flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-all"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-medium">More</span>
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-all"
                style={{ color: isActive ? 'var(--color-navy)' : 'var(--color-muted)' }}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && <div className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ backgroundColor: 'var(--color-navy)' }} />}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
