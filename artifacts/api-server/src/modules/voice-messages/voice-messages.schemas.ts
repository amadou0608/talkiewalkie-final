import { z } from 'zod'

// Section 13 : "limitation des fichiers audio" + "validation du type et de
// la taille des fichiers". ~8 Mo suffit largement a 180s d'audio compresse
// (Opus/AAC autour de 24-32 kbps) tout en restant raisonnable en donnees
// mobiles (section 19 : ne pas viser une qualite qui coute cher en data).
export const MAX_VOICE_MESSAGE_BYTES = 8 * 1024 * 1024
// Coherent avec la contrainte CHECK de la migration SQL.
export const MAX_VOICE_MESSAGE_DURATION_SEC = 180

// multipart/form-data : les champs texte arrivent toujours en string, meme
// pour un nombre — d'ou z.coerce.
export const sendVoiceMessageSchema = z.object({
  receiverUserId: z.string().uuid('Destinataire invalide.'),
  durationSec: z.coerce
    .number()
    .int()
    .min(1, 'Message vocal trop court.')
    .max(MAX_VOICE_MESSAGE_DURATION_SEC, 'Message vocal trop long (3 minutes maximum).'),
})

export const voiceMessageIdParamSchema = z.object({
  id: z.string().uuid('Identifiant de message invalide.'),
})

export type SendVoiceMessageInput = z.infer<typeof sendVoiceMessageSchema>
