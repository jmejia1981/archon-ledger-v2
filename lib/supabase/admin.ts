import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * `server-only` at the top makes importing this from a client component a build
 * error rather than a leak discovered later.
 *
 * Use it for exactly one thing: reaching tables the browser must never reach,
 * which today means plaid_items and its access tokens. Everything a signed-in
 * user is allowed to see should go through lib/supabase/server.ts instead, so RLS
 * stays in force for it.
 *
 * Every route that calls this must first establish that the caller is signed in.
 * This client has no notion of a user and will happily act without one.
 */
export function createAdminClient() {
  // Trimmed for the same reason as the Plaid values: a trailing newline picked
  // up from a dashboard or a pipe would produce an invalid JWT and a 401 that
  // points nowhere near the real cause.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    throw new Error(
      'Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
        'Add SUPABASE_SERVICE_ROLE_KEY to .env.local — it must never be prefixed NEXT_PUBLIC_.',
    )
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
