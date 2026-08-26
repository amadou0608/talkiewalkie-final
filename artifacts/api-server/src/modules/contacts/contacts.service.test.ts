import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/pool', () => ({
  pool: { query: vi.fn() },
}))
vi.mock('../users/users.repository', () => ({
  findUserRowById: vi.fn(),
  findUserRowByUsername: vi.fn(),
  normalizeUsername: (raw: string) => raw.trim().replace(/^@/, '').toLowerCase(),
}))

import { pool } from '../../db/pool'
import { findUserRowById, findUserRowByUsername } from '../users/users.repository'
import { addContact, blockContact, isAcceptedContact } from './contacts.service'

const mockedPool = vi.mocked(pool)
const mockedFindByUsername = vi.mocked(findUserRowByUsername)
const mockedFindById = vi.mocked(findUserRowById)

function fakeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'contact-1',
    username: 'saugui',
    display_name: 'Saugui',
    phone_number: null,
    avatar_url: null,
    password_hash: 'x',
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

describe('addContact', () => {
  it("refuse de s'ajouter soi-meme (CANNOT_ADD_SELF)", async () => {
    mockedFindByUsername.mockResolvedValue(fakeUserRow({ id: 'me' }))
    await expect(addContact('me', 'saugui')).rejects.toMatchObject({ code: 'CANNOT_ADD_SELF' })
  })

  it("refuse d'ajouter un utilisateur introuvable", async () => {
    mockedFindByUsername.mockResolvedValue(null)
    await expect(addContact('me', 'inconnu')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it("refuse d'ajouter un contact bloque sans le debloquer d'abord (CONTACT_BLOCKED)", async () => {
    mockedFindByUsername.mockResolvedValue(fakeUserRow())
    mockedPool.query.mockResolvedValueOnce({ rows: [{ status: 'blocked' }] } as never)

    await expect(addContact('me', 'saugui')).rejects.toMatchObject({ code: 'CONTACT_BLOCKED' })
  })

  it("refuse d'ajouter deux fois le meme contact accepte (CONTACT_EXISTS)", async () => {
    mockedFindByUsername.mockResolvedValue(fakeUserRow())
    mockedPool.query.mockResolvedValueOnce({ rows: [{ status: 'accepted' }] } as never)

    await expect(addContact('me', 'saugui')).rejects.toMatchObject({ code: 'CONTACT_EXISTS' })
  })

  it('ajoute un nouveau contact avec succes', async () => {
    mockedFindByUsername.mockResolvedValue(fakeUserRow())
    mockedPool.query
      .mockResolvedValueOnce({ rows: [] } as never) // getRelationStatus : aucune relation existante
      .mockResolvedValueOnce({ rows: [] } as never) // INSERT

    const result = await addContact('me', 'saugui')
    expect(result.relation).toBe('accepted')
    expect(result.user.username).toBe('saugui')
  })
})

describe('blockContact', () => {
  it('refuse de se bloquer soi-meme', async () => {
    await expect(blockContact('me', 'me')).rejects.toMatchObject({ code: 'CANNOT_ADD_SELF' })
  })

  it('refuse de bloquer un utilisateur introuvable', async () => {
    mockedFindById.mockResolvedValue(null)
    await expect(blockContact('me', 'contact-1')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })
})

describe('isAcceptedContact', () => {
  it('renvoie true seulement si la relation est "accepted"', async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ status: 'accepted' }] } as never)
    await expect(isAcceptedContact('me', 'contact-1')).resolves.toBe(true)
  })

  it('renvoie false pour une relation "pending", "blocked" ou absente', async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ status: 'blocked' }] } as never)
    await expect(isAcceptedContact('me', 'contact-1')).resolves.toBe(false)
  })
})
