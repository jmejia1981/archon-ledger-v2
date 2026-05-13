'use client'

import { useState, useEffect } from 'react'
import { Building2, User, Bell, Palette, Lock, Save, CheckCircle, AlertCircle } from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'
import { createClient } from '@/lib/supabase/client'

interface CompanySettings {
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  website: string
  license_number: string
}

const defaultCompany: CompanySettings = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  website: '',
  license_number: '',
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [company, setCompany] = useState<CompanySettings>(defaultCompany)

  const supabase = createClient()

  const settingsTabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'user', label: 'User Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Lock },
  ]

  useEffect(() => {
    const loadCompany = async () => {
      const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single()
      if (data) {
        setCompany({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
          website: data.website || '',
          license_number: data.license_number || '',
        })
      }
      setLoading(false)
    }
    loadCompany()
  }, [])

  const saveCompany = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('company_settings')
      .upsert({ id: 1, ...company, updated_at: new Date().toISOString() })
    if (error) {
      setMessage({ type: 'error', text: 'Failed to save company information.' })
    } else {
      setMessage({ type: 'success', text: 'Company information saved successfully!' })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  const field = (
    label: string,
    key: keyof CompanySettings,
    placeholder?: string,
    half?: boolean
  ) => (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={company[key]}
        onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: 'var(--color-border)', focusRingColor: 'var(--color-navy)' } as React.CSSProperties}
      />
    </div>
  )

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
              <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-navy)' }}>
                Company Information
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                This information appears on proposals and documents.
              </p>

              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {field('Company Name', 'name', 'Archon Construction LLC')}
                  {field('Email Address', 'email', 'info@company.com')}
                  {field('Phone Number', 'phone', '(555) 000-0000')}
                  {field('Website', 'website', 'www.company.com')}
                  {field('Street Address', 'address', '123 Main St')}
                  {field('City', 'city', 'City', true)}
                  {field('State', 'state', 'NJ', true)}
                  {field('ZIP Code', 'zip', '00000')}
                  {field('License Number', 'license_number', 'LIC-000000')}
                </div>
              )}
            </div>
          )}

          {activeTab === 'user' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                User Profile
              </h2>
              <p className="text-gray-600">User profile settings coming soon.</p>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Notifications
              </h2>
              <p className="text-gray-600">Notification preferences coming soon.</p>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Appearance
              </h2>
              <p className="text-gray-600">Appearance settings coming soon.</p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
                Security
              </h2>
              <p className="text-gray-600">Security settings coming soon.</p>
            </div>
          )}

          {activeTab === 'company' && !loading && (
            <div className="mt-6">
              <button
                onClick={saveCompany}
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
          )}
        </main>
      </div>
    </div>
  )
}
