import { z } from 'zod'

// Recherche par identifiant (section 7 : "Entrez @identifiant").
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Entrez un identifiant a rechercher.'),
})

export const addContactSchema = z.object({
  username: z.string().trim().min(1, 'Identifiant requis.'),
})

// UUID Postgres (colonne `id` des tables users/contacts, section 4).
export const contactUserIdParamSchema = z.object({
  contactUserId: z.string().uuid('Identifiant de contact invalide.'),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
export type AddContactInput = z.infer<typeof addContactSchema>
