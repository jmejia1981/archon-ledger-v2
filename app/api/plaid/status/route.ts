import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/plaid'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * What connections exist, without the credentials behind them.
 *
 * plaid_items is service-role only (RLS on, no policies), so the browser cannot
 * read it directly — by design, because it holds access tokens. But the card
 * still needs to know a connection exists: Sync used to render only when a Plaid
 * *account* was present, which meant a connection whose balances failed to store
 * could never be retried. The button was hidden exactly when it was needed.
 *
 * This returns the connection's identity and health and nothing else. The select
 * list is explicit so access_token cannot be added to the response by accident.
 */
export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('plaid_items')
    .select('id, institution_name, status, last_synced_at, last_error')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('plaid/status:', error.message)
    return NextResponse.json({ error: 'Could not read bank connections.' }, { status: 500 })
  }

  return NextResponse.json({
    connections: (data || []).map((i) => ({
      id: i.id,
      institution: i.institution_name,
      status: i.status,
      last_synced_at: i.last_synced_at,
      // Surfaced so a stuck connection explains itself rather than failing quietly.
      last_error: i.last_error,
    })),
  })
}
