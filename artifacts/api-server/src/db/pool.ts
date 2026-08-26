import { Pool } from 'pg'
import { env } from '../env'

// Pool de connexions partage — voir README pour la configuration PostgreSQL.
// SSL active automatiquement en production (ex. hebergeurs manages type
// Render/Railway/RDS exigent souvent sslmode=require).
export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.isProduction ? { rejectUnauthorized: false } : undefined,
})

pool.on('error', (err) => {
  // Erreur sur une connexion inactive du pool (ex. coupure reseau) — ne doit
  // pas crasher le process, juste etre journalisee.
  console.error('[db] erreur inattendue sur une connexion du pool', err)
})
