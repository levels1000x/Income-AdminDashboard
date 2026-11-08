import { z } from 'zod'
import { appAuth, assertSameOrigin } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const input = z
      .object({
        action: z.enum(['login', 'logout', 'accept']),
        email: z.string().email().optional(),
        password: z.string().min(12).max(128).optional(),
        token: z.string().optional(),
      })
      .strict()
      .parse(await request.json())
    if (input.action === 'logout') await appAuth.logout()
    else if (input.action === 'login') {
      if (!input.email || !input.password) throw new Error('Enter your email and password.')
      await appAuth.login(input.email, input.password)
    } else {
      if (!input.token || !input.password)
        throw new Error('An invitation token and password are required.')
      const payload = await getPayloadClient()
      const result = await payload.resetPassword({
        collection: 'users',
        data: { token: input.token, password: input.password },
        overrideAccess: false,
      })
      const identity = z
        .object({ id: z.string(), status: z.enum(['invited', 'active']) })
        .parse(result.user)
      // Native Payload reset tokens own expiry and single-use verification.
      await payload.update({
        collection: 'users',
        id: identity.id,
        overrideAccess: false,
        user: { ...result.user, collection: 'users' } as User,
        data: { status: 'active' },
        context: { acceptPortalInvitation: identity.id },
      })
    }
    return Response.json({ ok: true })
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          'Unable to sign in or accept this invitation. Check your credentials, invitation expiry, and password (12 characters minimum).',
      },
      { status: 400 },
    )
  }
}
