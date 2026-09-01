// Theme 2 — suppression programmee/ephemere façon Signal. Un message
// (texte, vocal, photo ou video) peut porter un delai de suppression choisi
// par l'expediteur a l'envoi. Le compte a rebours ne demarre qu'a la
// lecture par le destinataire (voir markRead/markConversationRead dans
// messages.service.ts) — un message envoye mais jamais lu ne disparait
// jamais tout seul.
import { AppError } from '../../utils/AppError'

export const DISAPPEAR_AFTER_OPTIONS_SEC = [30, 300, 3600, 86400, 604800] as const

export function parseDisappearAfterSec(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || !(DISAPPEAR_AFTER_OPTIONS_SEC as readonly number[]).includes(value)) {
    throw new AppError('VALIDATION_ERROR', 'Délai de suppression programmée invalide.', 400)
  }
  return value
}
