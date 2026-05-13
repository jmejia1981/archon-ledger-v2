'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const USERNAME_MAP: Record<string, string> = {
  juanmejia: 'juan@archonconstruction.co',
  joemejia: 'joe@archonconstruction.co',
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null])
  const router = useRouter()
  const supabase = createClient()

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    if (value && index < 3) {
      pinRefs.current[index + 1]?.focus()
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus()
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const email = USERNAME_MAP[username.toLowerCase().trim()]
    if (!email) {
      setError('Username not found')
      return
    }

    const pinString = pin.join('')
    if (pinString.length !== 4) {
      setError('Please enter your 4-digit PIN')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: `archon${pinString}`,
    })

    if (error) {
      setError('Invalid username or PIN')
      setLoading(false)
    } else {
      localStorage.setItem('archon_remember', rememberMe ? 'true' : 'false')
      if (!rememberMe) sessionStorage.setItem('archon_active', '1')
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
          <p className="text-center text-sm mb-8" style={{ color: 'var(--color-navy)', opacity: 0.7 }}>
            Sign in to your Archon Ledger account
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-navy)' }}>
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="e.g. juanmejia"
                autoComplete="username"
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  border: '1px solid rgba(0,0,0,0.15)',
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  color: 'var(--color-navy)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-navy)' }}>
                4-Digit PIN
              </label>
              <div className="flex gap-3 justify-center">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    id={`pin-${i}`}
                    name={`pin-${i}`}
                    ref={(el) => { pinRefs.current[i] = el }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    className="w-14 h-14 text-center text-2xl font-bold rounded-xl focus:outline-none focus:ring-2"
                    style={{
                      border: '1px solid rgba(0,0,0,0.15)',
                      backgroundColor: 'rgba(255,255,255,0.6)',
                      color: 'var(--color-navy)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Keep me logged in */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: 'var(--color-navy)' }}
              />
              <label htmlFor="rememberMe" className="text-sm cursor-pointer" style={{ color: 'var(--color-navy)' }}>
                Keep me logged in
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-100 px-4 py-2 rounded-lg text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60 mt-2"
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
