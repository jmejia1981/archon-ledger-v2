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
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    setLoading(false)

    if (error) {
      setError('Invalid email or password')
      return
    }

    const nextPath = new URLSearchParams(window.location.search).get('next') || '/dashboard'
    router.replace(nextPath)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-linen)' }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-lg p-8" style={{ backgroundColor: '#C8B89A' }}>
          <div className="flex justify-center mb-8">
            <Image src="/images/logo-website.png" alt="Archon Construction" width={160} height={64} priority style={{ objectFit: 'contain' }} />
          </div>

          <h1 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--color-navy)' }}>Welcome back</h1>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--color-navy)', opacity: 0.7 }}>Sign in with your Archon Ledger account</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ border: '1px solid rgba(0,0,0,0.15)', backgroundColor: 'rgba(255,255,255,0.6)', color: 'var(--color-navy)' }} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }} htmlFor="password">Password</label>
              <input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2" style={{ border: '1px solid rgba(0,0,0,0.15)', backgroundColor: 'rgba(255,255,255,0.6)', color: 'var(--color-navy)' }} />
            </div>

            {error && <p className="text-sm text-red-700 bg-red-100 px-4 py-2 rounded-lg text-center">{error}</p>}

            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60 mt-2" style={{ backgroundColor: 'var(--color-navy)' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}