// Lanceur de migrations minimal — Phase 3.
// Volontairement simple (pas de framework de migration) : lit les fichiers
// .sql de ce dossier dans l'ordre alphabetique, et n'applique que ceux qui
// ne sont pas deja enregistres dans `schema_migrations`. Relancable sans
// risque (`npm run migrate`).
import fs from 'node:fs'
import path from 'node:path'
import { pool } from './pool'

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name         TEXT PRIMARY KEY,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>('SELECT name FROM schema_migrations')
  return new Set(result.rows.map((row) => row.name))
}

async function runMigrations() {
  await ensureMigrationsTable()
  const applied = await getAppliedMigrations()

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log('[migrate] rien a appliquer, la base est a jour.')
    return
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`[migrate] applique : ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`[migrate] echec sur ${file}, annule.`)
      throw err
    } finally {
      client.release()
    }
  }

  console.log(`[migrate] ${pending.length} migration(s) appliquee(s).`)
}

runMigrations()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
    return pool.end()
  })
