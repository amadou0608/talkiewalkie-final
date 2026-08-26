import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth'
import { strictRateLimit } from '../../middleware/security'
import { add, block, blocked, list, remove, search, unblock } from './contacts.controller'

export const contactsRouter = Router()

// Toutes les routes contacts exigent une session (section 6-7 du cahier des
// charges : la liste de contacts est privee a chaque utilisateur).
contactsRouter.use(requireAuth)

// Recherche d'utilisateurs : une requete DB par appel, cible facile pour un
// script qui enumererait les identifiants existants (section 13). Limite
// plus stricte que le reste de l'API.
const searchRateLimit = strictRateLimit(30)

// Routes fixes AVANT la route parametree /:contactUserId, sinon Express
// tenterait de traiter "search" ou "blocked" comme un identifiant.
contactsRouter.get('/search', searchRateLimit, search)
contactsRouter.get('/blocked', blocked)

contactsRouter.get('/', list)
contactsRouter.post('/', add)
contactsRouter.delete('/:contactUserId', remove)
contactsRouter.post('/:contactUserId/block', block)
contactsRouter.post('/:contactUserId/unblock', unblock)
