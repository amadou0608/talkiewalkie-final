import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from './jwt'

describe('jwt session utils', () => {
  it('signe puis verifie une session valide', () => {
    const token = signSession({ userId: 'user-123' })
    const payload = verifySession(token)
    expect(payload).toEqual({ userId: 'user-123' })
  })

  it('rejette un token altere', () => {
    const token = signSession({ userId: 'user-123' })
    const tampered = `${token.slice(0, -2)}xx`
    expect(verifySession(tampered)).toBeNull()
  })

  it('rejette un token completement invalide', () => {
    expect(verifySession('ceci-nest-pas-un-jwt')).toBeNull()
  })
})
