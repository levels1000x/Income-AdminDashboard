import type { Access, FieldAccess } from 'payload'

type Identity = { collection?: string; role?: string; status?: string } | null | undefined
export function isStaff(user: Identity) {
  return user?.collection === 'admins' || (user?.collection === 'users' && user.status === 'active')
}
export function isManager(user: Identity) {
  return user?.collection === 'admins' || (isStaff(user) && ['administrator', 'manager'].includes(user?.role || ''))
}
export const staffAccess: Access = ({ req }) => isStaff(req.user)
export const managerAccess: Access = ({ req }) => isManager(req.user)
export const managerField: FieldAccess = ({ req }) => isManager(req.user)
export const immutableField: FieldAccess = () => false
