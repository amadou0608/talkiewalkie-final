import { beforeEach, describe, expect, it, vi } from 'vitest'

// pool.query est mocke : ces tests verifient la logique metier (regles
// d'erreur, appels attendus), pas le SQL lui-meme — voir src/test/README.md
// pour les tests d'integration necessitant une vraie base Postgres.
vi.mock('../../db/pool', () => ({
  pool: { query: vi.fn() },
}))
vi.mock('../users/users.repository', () => ({
  findUserRowById: vi.fn(),
  findUserRowByUsername: vi.fn(),
  normalizeUsername: (raw: string) => raw.trim().replace(/^@/, '').toLowerCase(),
}))
vi.mock('../voice-messages/storage', () => ({
  deleteVoiceMessageFile: vi.fn(),
}))

import { pool } from '../../db/pool'
import { findUserRowByUsername } from '../users/users.repository'
import { deleteVoiceMessageFile } from '../voice-messages/storage'
import { deleteAccount, loginUser, registerUser } from './auth.service'
import { hashPassword } from '../../utils/password'

const mockedPool = vi.mocked(pool)
const mockedFindByUsername = vi.mocked(findUserRowByUsername)
const mockedDeleteFile = vi.mocked(deleteVoiceMessageFile)

function fakeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    username: 'moussa123',
    display_name: 'Moussa',
    phone_number: null,
    avatar_url: null,
    password_hash: '',
    created_at: new Date(),
    updated_at: new Date(),
    last_seen: new Date(),
    is_online: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registerUser', () => {
  it("refuse un identifiant deja pris (USERNAME_TAKEN)", async () => {
    mockedFindByUsername.mockResolvedValue(fakeUserRow())

    await expect(
      registerUser({ displayName: 'Moussa', username: 'moussa123', password: 'motdepasse123' }),
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' })
  })

  it('cree un utilisateur et ne renvoie jamais password_hash', async () => {
    mockedFindByUsername.mockResolvedValue(null)
    mockedPool.query.mockResolvedValue({
      rows: [fakeUserRow({ password_hash: 'un-hash-bcrypt' })],
    } as never)

    const user = await registerUser({ displayName: 'Moussa', username: 'moussa123', password: 'motdepasse123' })

    expect(user).not.toHaveProperty('password_hash')
    expect(user.username).toBe('moussa123')
    // Le mot de passe passe a la requete INSERT doit etre un hash, jamais le mot de passe en clair.
    const insertArgs = mockedPool.query.mock.calls[0][1] as unknown[]
    expect(insertArgs).not.toContain('motdepasse123')
  })
})

describe('loginUser', () => {
  it("rejette avec le meme message qu'un mauvais mot de passe si l'identifiant n'existe pas (anti-enumeration)", async () => {
    mockedFindByUsername.mockResolvedValue(null)

    await expect(loginUser({ username: 'inconnu', password: 'peu-importe' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('rejette un mot de passe incorrect', async () => {
    const hash = await hashPassword('bon-mot-de-passe')
    mockedFindByUsername.mockResolvedValue(fakeUserRow({ password_hash: hash }))

    await expect(loginUser({ username: 'moussa123', password: 'mauvais-mot-de-passe' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('connecte un utilisateur avec le bon mot de passe', async () => {
    const hash = await hashPassword('bon-mot-de-passe')
    mockedFindByUsername.mockResolvedValue(fakeUserRow({ password_hash: hash }))
    mockedPool.query.mockResolvedValue({ rows: [fakeUserRow({ password_hash: hash, is_online: true })] } as never)

    const user = await loginUser({ username: 'moussa123', password: 'bon-mot-de-passe' })
    expect(user.username).toBe('moussa123')
  })
})

describe('deleteAccount', () => {
  it('supprime les fichiers audio associes puis le compte, et propage USER_NOT_FOUND si absent', async () => {
    mockedPool.query
      .mockResolvedValueOnce({ rows: [{ storage_path: 'a.webm' }, { storage_path: 'b.webm' }] } as never)
      .mockResolvedValueOnce({ rowCount: 0 } as never)

    await expect(deleteAccount('user-1')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
    expect(mockedDeleteFile).toHaveBeenCalledWith('a.webm')
    expect(mockedDeleteFile).toHaveBeenCalledWith('b.webm')
  })

  it('supprime le compte avec succes quand il existe', async () => {
    mockedPool.query
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rowCount: 1 } as never)

    await expect(deleteAccount('user-1')).resolves.toBeUndefined()
  })
})
