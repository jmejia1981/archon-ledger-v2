import 'server-only'

// plaid v52 moved this API to the `legacy` entrypoint and added a new client
// alongside it. The legacy one is what the v52 README documents and what the
// routes here are written against; the new client's surface is undocumented in
// the package, so guessing at it would be worse than using the supported path.
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid/legacy'

import { createClient } from '@/lib/supabase/server'

/**
 * Plaid client and the guard every Plaid route starts with.
 *
 * PLAID_SECRET is read here and nowhere else. It is not prefixed NEXT_PUBLIC_, so
 * Next will not inline it into the browser bundle, and `server-only` turns a
 * client import of this file into a build error.
 */

export function plaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const env = (process.env.PLAID_ENV || 'sandbox').toLowerCase()

  if (!clientId || !secret) {
    throw new Error(
      'Plaid is not configured. Add PLAID_CLIENT_ID, PLAID_SECRET and PLAID_ENV to .env.local.',
    )
  }
  const basePath = PlaidEnvironments[env as keyof typeof PlaidEnvironments]
  if (!basePath) {
    throw new Error(`PLAID_ENV must be sandbox or production — got "${env}".`)
  }

  return new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret },
      },
    }),
  )
}

/**
 * Every Plaid route is behind the session.
 *
 * These routes reach bank credentials through the service role, which has no
 * notion of a user, so the check cannot be skipped: without it an unauthenticated
 * request to /api/plaid/sync would pull the business's bank data.
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

/** Plaid errors carry useful detail; the secret is never part of it, but trim anyway. */
export function plaidErrorMessage(err: any): string {
  const d = err?.response?.data
  if (d?.error_message) return `${d.error_code || 'PLAID_ERROR'}: ${d.error_message}`
  return err?.message || 'Plaid request failed.'
}
