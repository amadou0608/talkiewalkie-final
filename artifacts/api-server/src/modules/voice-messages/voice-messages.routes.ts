import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../../middleware/requireAuth'
import { strictRateLimit } from '../../middleware/security'
import { MAX_VOICE_MESSAGE_BYTES } from './voice-messages.schemas'
import { audio, list, listened, send } from './voice-messages.controller'

// Stockage en memoire : le fichier est de toute facon plafonne (limite
// ci-dessous) et n'a besoin d'exister que le temps d'etre ecrit sur disque
// par storage.ts — pas la peine d'un fichier temporaire intermediaire pour
// un vocal de quelques Mo maximum.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VOICE_MESSAGE_BYTES },
})

export const voiceMessagesRouter = Router()

// Toutes les routes exigent une session (section 13/14 : un vocal est un
// contenu prive entre deux utilisateurs).
voiceMessagesRouter.use(requireAuth)

// Ecriture disque + insertion DB a chaque appel : plus couteux qu'un simple
// GET, donc limite dediee (section 13). 20/min laisse largement de la marge
// a un usage normal (un vocal dure au plus 180s, voir schemas.ts) tout en
// bornant un script qui enverrait des fichiers en boucle.
const sendRateLimit = strictRateLimit(20)

voiceMessagesRouter.get('/', list)
voiceMessagesRouter.post('/', sendRateLimit, upload.single('audio'), send)
voiceMessagesRouter.get('/:id/audio', audio)
voiceMessagesRouter.post('/:id/listened', listened)
