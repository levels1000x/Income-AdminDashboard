import { APIError, type Access, type CollectionConfig } from 'payload'
import { isStaff } from '../lib/portal-access'

const ownsPreferences: Access = ({ req }) => {
  if (!req.user || !isStaff(req.user)) return false
  return { recipientKey: { equals: `${req.user.collection}:${req.user.id}` } }
}
export const NotificationPreferences: CollectionConfig = {
  slug: 'notification-preferences',
  admin: { useAsTitle: 'recipientKey', group: 'Income operations' },
  access: {
    read: ownsPreferences,
    create: ({ req }) => isStaff(req.user) && req.context.alertSettingsWrite === true,
    update: (args) =>
      args.req.context.alertSettingsWrite === true ? ownsPreferences(args) : false,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [
      ({ data, req, operation }) => {
        if (operation === 'create') {
          if (!req.user || !isStaff(req.user))
            throw new APIError('Sign in to configure alerts.', 401)
          return {
            ...data,
            recipientKey: `${req.user.collection}:${req.user.id}`,
            recipient: { relationTo: req.user.collection, value: req.user.id },
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'recipientKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      access: { create: ({ req }) => req.context.alertSettingsWrite === true, update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: ['admins', 'users'],
      required: true,
      access: { create: ({ req }) => req.context.alertSettingsWrite === true, update: () => false },
      admin: { readOnly: true },
    },
    { name: 'leadAlerts', type: 'checkbox', defaultValue: true },
    { name: 'soundEnabled', type: 'checkbox', defaultValue: true },
    { name: 'callReminders', type: 'checkbox', defaultValue: true },
    {
      name: 'advanceMinutes',
      type: 'select',
      options: ['5', '10', '15', '30'],
      defaultValue: '10',
      required: true,
    },
    { name: 'followUpReminders', type: 'checkbox', defaultValue: true },
    { name: 'desktopEnabled', type: 'checkbox', defaultValue: false },
  ],
}
