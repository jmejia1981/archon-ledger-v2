import { NextResponse } from 'next/server'
import { CountryCode, Products } from 'plaid/legacy'

import { plaidClient, requireUser, plaidErrorMessage } from '@/lib/plaid'

export const dynamic = 'force-dynamic'

/**
 * Mints the short-lived token that opens Plaid Link in the browser.
 *
 * A link token is safe to hand to the client — it expires in minutes and cannot
 * read anything. PLAID_SECRET stays here.
 */
export async function POST() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  try {
    const res = await plaidClient().linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Archon Ledger',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })
    return NextResponse.json({ link_token: res.data.link_token })
  } catch (err: any) {
    console.error('plaid/link-token:', plaidErrorMessage(err))
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 502 })
  }
}
