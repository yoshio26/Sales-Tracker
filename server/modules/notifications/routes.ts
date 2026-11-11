/// <reference path="../../types/express.d.ts" />

import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { getNotificationSettings, updateNotificationSettings } from './service.js'

const settingsSchema = z.object({
  recipientEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  addedEnabled: z.boolean(),
  deletedEnabled: z.boolean(),
  changedEnabled: z.boolean(),
})

export const notificationsRouter = Router()

notificationsRouter.get('/settings', requireSession, async (req, res, next) => {
  try { res.json({ settings: await getNotificationSettings(req.userId!) }) } catch (error) { next(error) }
})

notificationsRouter.put('/settings', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const input = settingsSchema.parse(req.body)
    const settings = await updateNotificationSettings(req.userId!, { ...input, recipientEmail: input.recipientEmail || null })
    res.json({ settings: { ...settings, recipientEmail: settings.recipientEmail ?? '' } })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter valid notification settings.' } })
    next(error)
  }
})
