import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/pool', () => ({
  pool: { query: vi.fn() },
}))
vi.mock('../users/users.repository', () => ({
  findUserRowById: vi.fn(),
  findUserRowsByIds: vi.fn(),
}))
vi.mock('../contacts/contacts.service', () => ({
  isAcceptedContact: vi.fn(),
}))
vi.mock('./storage', () => ({
  saveVoiceMessageFile: vi.fn(() => ({ relativePath: 'fichier.webm' })),
  deleteVoiceMessageFile: vi.fn(),
}))

import { pool } from '../../db/pool'
import { findUserRowById } from '../users/users.repository'
import { isAcceptedContact } from '../contacts/contacts.service'
import { createVoiceMessage, getVoiceMessageForAccess } from './voice-messages.service'

const mockedPool = vi.mocked(pool)
const mockedFindById = vi.mocked(findUserRowById)
const mockedIsAcceptedContact = vi.mocked(isAcceptedContact)

function fakeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'receiver-1',
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

const validFile = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 1024 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createVoiceMessage', () => {
  it("refuse un envoi a soi-meme", async () => {
    await expect(createVoiceMessage('me', 'me', 12, validFile)).rejects.toMatchObject({ code: 'CANNOT_ADD_SELF' })
  })

  it('refuse un destinataire introuvable', async () => {
    mockedFindById.mockResolvedValue(null)
    await expect(createVoiceMessage('me', 'receiver-1', 12, validFile)).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
  })

  it("refuse l'envoi si les deux utilisateurs ne sont pas contacts (section 6)", async () => {
    mockedFindById.mockResolvedValue(fakeUserRow())
    mockedIsAcceptedContact.mockResolvedValue(false)

    await expect(createVoiceMessage('me', 'receiver-1', 12, validFile)).rejects.toMatchObject({
      code: 'CONTACT_NOT_FOUND',
    })
  })

  it('refuse un fichier dont le type MIME n\'est pas audio', async () => {
    mockedFindById.mockResolvedValue(fakeUserRow())
    mockedIsAcceptedContact.mockResolvedValue(true)

    await expect(
      createVoiceMessage('me', 'receiver-1', 12, { ...validFile, mimetype: 'application/pdf' }),
    ).rejects.toMatchObject({ code: 'INVALID_AUDIO_FILE' })
  })

  it('cree le message vocal quand tout est valide', async () => {
    // findUserRowById est appele deux fois par createVoiceMessage (verification
    // du destinataire, puis recuperation de l'expediteur pour la reponse) —
    // le mock renvoie la meme ligne factice pour les deux, sans consequence
    // sur les assertions ci-dessous (portees sur le message, pas l'identite).
    mockedFindById.mockResolvedValue(fakeUserRow())
    mockedIsAcceptedContact.mockResolvedValue(true)
    mockedPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'vm-1',
          sender_id: 'me',
          receiver_id: 'receiver-1',
          storage_path: 'fichier.webm',
          mime_type: 'audio/webm',
          size_bytes: 1024,
          duration_sec: 12,
          created_at: new Date(),
          delivered_at: new Date(),
          listened_at: null,
        },
      ],
    } as never)

    const message = await createVoiceMessage('me', 'receiver-1', 12, validFile)
    expect(message.id).toBe('vm-1')
    expect(message.durationSec).toBe(12)
  })
})

describe('getVoiceMessageForAccess', () => {
  it("refuse l'acces a un tiers qui n'est ni expediteur ni destinataire (section 13/14)", async () => {
    mockedPool.query.mockResolvedValueOnce({
      rows: [{ id: 'vm-1', sender_id: 'a', receiver_id: 'b', storage_path: 'f.webm' }],
    } as never)

    await expect(getVoiceMessageForAccess('vm-1', 'un-tiers')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('renvoie 404 si le message n\'existe pas', async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [] } as never)
    await expect(getVoiceMessageForAccess('inconnu', 'me')).rejects.toMatchObject({
      code: 'VOICE_MESSAGE_NOT_FOUND',
    })
  })
})
