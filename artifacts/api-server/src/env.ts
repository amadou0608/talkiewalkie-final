// Charge et valide les variables d'environnement au demarrage du serveur.
// Echoue vite et clairement si une variable requise manque, plutot que de
// laisser une erreur obscure surgir plus tard (ex. connexion DB qui echoue).
import 'dotenv/config'

function required(name: string, fallbackName?: string): string {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined)
  if (!value) {
    const names = fallbackName ? `${name} ou ${fallbackName}` : name
    throw new Error(`Variable d'environnement manquante : ${names}.`)
  }
  return value
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', 'SESSION_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? true,
  isProduction: process.env.NODE_ENV === 'production',
  // Phase 9 (section 11) : volontairement optionnelles, contrairement aux
  // variables ci-dessus. Un serveur sans cles VAPID doit demarrer normalement
  // (les autres phases ne dependent pas du push) — voir push.service.ts pour
  // la desactivation gracieuse et le README pour la generation des cles.
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY ?? '',
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY ?? '',
  webPushContactEmail: process.env.WEB_PUSH_CONTACT_EMAIL ?? 'mailto:contact@talkie.app',
}
