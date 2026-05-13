'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-linen)' }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-lg p-8" style={{ backgroundColor: '#C8B89A' }}>
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/images/logo-website.png"
              alt="Archon Construction"
              width={160}
              height={64}
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>

          <h1 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--color-navy)' }}>
            Welcome back
          </h1>
          <p className="text-center text-sm text-gray-500 mb-8">
            Sign in to your Archon Ledger account
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'white',
                  color: 'var(--color-navy)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'white',
                  color: 'var(--color-navy)',
                }}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-navy)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
