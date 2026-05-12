'use client'

import { useState } from 'react'
import { Clock, CheckCircle, AlertCircle, RefreshCw, Mail, BarChart3 } from 'lucide-react'
import { Breadcrumbs } from '@/app/components/breadcrumbs'

interface AutomationTask {
  id: string
  name: string
  description: string
  schedule: string
  lastRun?: string
  status: 'idle' | 'running' | 'success' | 'error'
  icon: React.ReactNode
}

export default function AutomationPage() {
  const [tasks, setTasks] = useState<AutomationTask[]>([
    {
      id: 'invoice-reminders',
      name: 'Invoice Reminders',
      description: 'Send email reminders for due and overdue invoices',
      schedule: 'Daily at 9:00 AM',
      status: 'idle',
      icon: <Mail className="w-5 h-5" />,
    },
    {
      id: 'monthly-reports',
      name: 'Monthly Reports',
      description: 'Generate and send monthly financial reports',
      schedule: '1st of every month at 8:00 AM',
      status: 'idle',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      id: 'project-maintenance',
      name: 'Project Maintenance',
      description: 'Check project deadlines and archive completed projects',
      schedule: 'Every Monday at 10:00 AM',
      status: 'idle',
      icon: <Clock className="w-5 h-5" />,
    },
  ])

  const [loading, setLoading] = useState(false)
  const [secretKey, setSecretKey] = useState('')
  const [showSecretInput, setShowSecretInput] = useState(false)

  const triggerTask = async (taskId: string) => {
    if (!secretKey) {
      setShowSecretInput(true)
      return
    }

    setLoading(true)
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, status: 'running' as const } : t
    )
    setTasks(updatedTasks)

    try {
      const response = await fetch(`/api/automation/${taskId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        await response.json()
        setTasks(tasks.map(t =>
          t.id === taskId
            ? { ...t, status: 'success' as const, lastRun: new Date().toISOString() }
            : t
        ))
        setTimeout(() => {
          setTasks(tasks.map(t =>
            t.id === taskId ? { ...t, status: 'idle' as const } : t
          ))
        }, 3000)
      } else {
        setTasks(tasks.map(t =>
          t.id === taskId ? { ...t, status: 'error' as const } : t
        ))
      }
    } catch (error) {
      console.error('Error triggering task:', error)
      setTasks(tasks.map(t =>
        t.id === taskId ? { ...t, status: 'error' as const } : t
      ))
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'running':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />
      case 'error':
        return <AlertCircle className="w-5 h-5" />
      case 'running':
        return <RefreshCw className="w-5 h-5 animate-spin" />
      default:
        return <Clock className="w-5 h-5" />
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Automation' },
        ]}
      />

      <div className="mt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>
            Task Automation
          </h1>
          <p className="text-gray-600 mt-2">
            Manage and monitor scheduled tasks for invoices, reports, and project maintenance
          </p>
        </div>

        {/* Info Card */}
        <div
          className="rounded-lg p-6 mb-8"
          style={{ backgroundColor: 'var(--color-linen)', borderLeft: '4px solid var(--color-gold)' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-navy)' }}>
            <strong>📌 Setup Required:</strong> Automated tasks need to be configured with an external scheduler. See AUTOMATION_SETUP.md for detailed instructions on setting up with Vercel Cron, cron-job.org, or other services.
          </p>
        </div>

        {/* Secret Key Input */}
        {showSecretInput && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>
              Enter Scheduler Secret Key
            </p>
            <div className="flex gap-2 mt-3">
              <input
                type="password"
                placeholder="SCHEDULER_SECRET_KEY"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="flex-1 px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => setShowSecretInput(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Tasks Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-lg border p-6 transition hover:shadow-lg"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--color-linen)' }}
                >
                  {task.icon}
                </div>
                <div className={`${getStatusColor(task.status)}`}>
                  {getStatusIcon(task.status)}
                </div>
              </div>

              {/* Title */}
              <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--color-navy)' }}>
                {task.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4">{task.description}</p>

              {/* Schedule */}
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Clock className="w-4 h-4" />
                <span>{task.schedule}</span>
              </div>

              {/* Last Run */}
              {task.lastRun && (
                <p className="text-xs text-gray-500 mb-4">
                  Last run: {new Date(task.lastRun).toLocaleString()}
                </p>
              )}

              {/* Status Text */}
              <div className="mb-4 text-sm font-medium">
                {task.status === 'running' && (
                  <span className="text-blue-600">Running...</span>
                )}
                {task.status === 'success' && (
                  <span className="text-green-600">✓ Completed</span>
                )}
                {task.status === 'error' && (
                  <span className="text-red-600">✗ Error occurred</span>
                )}
                {task.status === 'idle' && (
                  <span className="text-gray-600">Ready</span>
                )}
              </div>

              {/* Trigger Button */}
              <button
                onClick={() => triggerTask(task.id)}
                disabled={loading || task.status === 'running'}
                className="w-full px-4 py-2 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  backgroundColor: 'var(--color-navy)',
                  color: 'white',
                }}
              >
                {task.status === 'running' ? 'Running...' : 'Run Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Configuration Guide */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
            Configuration Options
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Vercel */}
            <div className="border rounded-lg p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-navy)' }}>
                Vercel Cron
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                If deployed on Vercel, add cron triggers to vercel.json:
              </p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto mb-4">
{`{
  "crons": [
    {
      "path": "/api/automation/invoice-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}`}
              </pre>
              <p className="text-xs text-gray-500">
                See docs: vercel.com/docs/crons
              </p>
            </div>

            {/* External Service */}
            <div className="border rounded-lg p-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-navy)' }}>
                External Cron Service
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Use services like cron-job.org or EasyCron:
              </p>
              <div className="bg-gray-50 p-3 rounded text-xs space-y-2 mb-4">
                <p><strong>URL:</strong> /api/automation/invoice-reminders</p>
                <p><strong>Method:</strong> POST</p>
                <p><strong>Header:</strong> Authorization: Bearer [KEY]</p>
              </div>
              <p className="text-xs text-gray-500">
                Set SCHEDULER_SECRET_KEY in .env.local
              </p>
            </div>
          </div>
        </div>

        {/* Email Configuration */}
        <div className="mt-12 p-6 rounded-lg" style={{ backgroundColor: 'var(--color-linen)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-navy)' }}>
            Email Configuration
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            Choose one email provider and set the corresponding environment variables:
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>Resend (Recommended)</p>
              <code className="text-xs bg-white p-2 rounded block mt-1">RESEND_API_KEY=re_xxxxx</code>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>SendGrid</p>
              <code className="text-xs bg-white p-2 rounded block mt-1">SENDGRID_API_KEY=SG.xxxxx</code>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>SMTP</p>
              <code className="text-xs bg-white p-2 rounded block mt-1">SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
