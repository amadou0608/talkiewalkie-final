import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth'
import { publicKey, subscribe, unsubscribe } from './push.controller'

export const pushRouter = Router()

// Un abonnement push est propre a un compte (section 14 : confidentialite) —
// aucune route de ce module n'est utile sans session.
pushRouter.use(requireAuth)

pushRouter.get('/public-key', publicKey)
pushRouter.post('/subscribe', subscribe)
pushRouter.post('/unsubscribe', unsubscribe)
