import { z } from 'zod'

// Memes regles que cote frontend (src/lib/authApi.ts) : 3-24 caracteres,
// lettres minuscules/chiffres/underscore. Le frontend valide deja avant
// d'envoyer, mais le serveur ne fait jamais confiance au client.
export const usernameSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, '').toLowerCase())
  .refine((v) => /^[a-z0-9_]{3,24}$/.test(v), {
    message: '3 a 24 caracteres : lettres minuscules, chiffres, underscore uniquement.',
  })

export const passwordSchema = z.string().min(8, '8 caracteres minimum.')

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, 'Le nom affiche est requis.').max(80),
  username: usernameSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
