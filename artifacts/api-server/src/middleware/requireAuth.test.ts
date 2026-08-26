import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { requireAuth } from './requireAuth'
import { signSession } from '../utils/jwt'
import { AppError } from '../utils/AppError'

function fakeReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request
}

describe('requireAuth', () => {
  it("rejette une requete sans cookie de session avec UNAUTHENTICATED (401)", () => {
    const next = vi.fn()
    requireAuth(fakeReq(), {} as Response, next)

    expect(next).toHaveBeenCalledTimes(1)
    const err = next.mock.calls[0][0] as AppError
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('UNAUTHENTICATED')
    expect(err.status).toBe(401)
  })

  it('rejette un cookie de session invalide/altere', () => {
    const next = vi.fn()
    requireAuth(fakeReq({ talkie_session: 'token-invalide' }), {} as Response, next)

    const err = next.mock.calls[0][0] as AppError
    expect(err.code).toBe('UNAUTHENTICATED')
  })

  it('accepte un cookie de session valide et attache req.userId', () => {
    const token = signSession({ userId: 'user-abc' })
    const req = fakeReq({ talkie_session: token })
    const next = vi.fn()

    requireAuth(req, {} as Response, next)

    expect(next).toHaveBeenCalledWith() // appele sans erreur
    expect(req.userId).toBe('user-abc')
  })
})
