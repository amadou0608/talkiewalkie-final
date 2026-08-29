// Erreur applicative avec un code stable et un statut HTTP.
// Le frontend (src/lib/authApi.ts) attend precisement cette forme
// { code, message } dans le corps de la reponse d'erreur.
export type AppErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USERNAME_TAKEN'
  | 'WEAK_PASSWORD'
  | 'INVALID_USERNAME'
  | 'UNAUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN'
  // Phase 4 — contacts (section 6-7 du cahier des charges)
  | 'USER_NOT_FOUND'
  | 'CANNOT_ADD_SELF'
  | 'CONTACT_EXISTS'
  | 'CONTACT_BLOCKED'
  | 'CONTACT_NOT_FOUND'
  // Phase 8 — messages vocaux hors ligne (section 10 du cahier des charges)
  | 'INVALID_AUDIO_FILE'
  | 'VOICE_MESSAGE_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'FORBIDDEN'
  // Phase 11 — securite (section 13 du cahier des charges)
  | 'RATE_LIMITED'
  | 'CSRF_REJECTED'
  | 'NETWORK_ERROR'
  // Phase 13-19 — messagerie complete (photo, video, generique)
  | 'INVALID_IMAGE_FILE'
  | 'INVALID_VIDEO_FILE'
  | 'VIDEO_TOO_LONG'
  | 'NOT_FOUND'
  // Phase 21 — stories
  | 'STORY_NOT_FOUND'
  // Phase 22 — confidentialite des stories
  | 'INVALID_VISIBILITY_MODE'
  | 'INVALID_STORY_TYPE'
  | 'INVALID_TEXT_CONTENT'

export class AppError extends Error {
  code: AppErrorCode
  status: number

  constructor(code: AppErrorCode, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
      }
