import { z } from 'zod'

// Forme exacte d'un PushSubscription serialise cote navigateur
// (subscription.toJSON()) — voir usePushNotifications.ts cote frontend.
export const pushKeysSchema = z.object({
  p256dh: z.string().min(1, 'Cle p256dh manquante.'),
  auth: z.string().min(1, 'Cle auth manquante.'),
})

export const subscribeSchema = z.object({
  endpoint: z.string().url('Endpoint d\u2019abonnement invalide.'),
  keys: pushKeysSchema,
  platform: z.string().max(50).optional(),
})

export const unsubscribeSchema = z.object({
  endpoint: z.string().url('Endpoint d\u2019abonnement invalide.'),
})

export type SubscribeInput = z.infer<typeof subscribeSchema>
