import 'server-only'
import { cookies, headers } from 'next/headers'
import { getPayloadClient } from './payload'

export function createAppAuth(collection: 'users') {
  return {
    async currentUser() {
      const payload = await getPayloadClient()
      const token = (await cookies()).get('app-session')?.value
      if (!token) return null
      const { user } = await payload.auth({
        headers: new Headers({ Authorization: `JWT ${token}` }),
      })
      if (!user || user.collection !== collection) return null
      const fresh = await payload.findByID({
        collection,
        id: user.id,
        overrideAccess: false,
        user,
        depth: 0,
      })
      return fresh.status === 'active' ? { ...fresh, collection } : null
    },
    async login(email: string, password: string) {
      const payload = await getPayloadClient()
      const result = await payload.login({ collection, data: { email, password } })
      if (!result.user || result.user.status !== 'active' || !result.token)
        throw new Error('This account is not active.')
      const store = await cookies()
      store.set('app-session', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 28800,
      })
    },
    async logout() {
      ;(await cookies()).delete('app-session')
    },
  }
}
export const appAuth = createAppAuth('users')
export async function portalIdentity() {
  const appUser = await appAuth.currentUser()
  if (appUser) return appUser
  // This is an internal tool. Existing CMS editors retain their managed SSO flow.
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return user?.collection === 'admins' ? user : null
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const approved = [
    request.headers.get('host'),
    request.headers.get('x-forwarded-host'),
    new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').host,
  ]
  if (!origin || !approved.includes(new URL(origin).host))
    throw new Error('Invalid request origin.')
}
