'use client'

import { useState } from 'react'
import { Building2, User, Bell, Palette, Lock, Save, CheckCircle, AlertCircle } from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const settingsTabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'user', label: 'User Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Lock },
  ]

  const saveSettings = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    setMessage({ type: 'success', text: 'Settings saved successfully!' })
    setSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />

      <div className="mt-8 mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>
          Settings
        </h1>
        <p className="text-gray-600 mt-1">Manage your account and application preferences</p>
      </div>

      {message && (
        <div className="mb-6 p-4 rounded-lg border flex items-start gap-3" style={{
          backgroundColor: message.type === 'success' ? '#e8f5e9' : '#ffebee',
          borderColor: message.type === 'success' ? '#c8e6c9' : '#ffcdd2',
        }}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm" style={{ color: message.type === 'success' ? '#2e7d32' : '#d32f2f' }}>
            {message.text}
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-56 flex-shrink-0">
          <nav className="space-y-2">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all"
                  style={{
                    backgroundColor: isActive ? '#C8B89A' : 'transparent',
                    color: '#1A3A6B',
                  }}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1">
          {activeTab === 'company' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Company Information
              </h2>
              <p className="text-gray-600">Company settings content here</p>
            </div>
          )}

          {activeTab === 'user' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                User Profile
              </h2>
              <p className="text-gray-600">User profile content here</p>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Notifications
              </h2>
              <p className="text-gray-600">Notification preferences here</p>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Appearance
              </h2>
              <p className="text-gray-600">Appearance settings here</p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Security
              </h2>
              <p className="text-gray-600">Security settings here</p>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-navy)' }}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
