import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { csrfProtection } from './csrfProtection'
import { AppError } from '../utils/AppError'

function fakeReq(method: string, headers: Record<string, string> = {}): Request {
  return { method, headers } as unknown as Request
}

describe('csrfProtection', () => {
  it('laisse passer les methodes surs (GET) sans en-tete', () => {
    const next = vi.fn()
    csrfProtection(fakeReq('GET'), {} as Response, next)
    expect(next).toHaveBeenCalledWith()
  })

  it("bloque un POST sans en-tete X-Requested-With (403 CSRF_REJECTED)", () => {
    const next = vi.fn()
    csrfProtection(fakeReq('POST'), {} as Response, next)

    const err = next.mock.calls[0][0] as AppError
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('CSRF_REJECTED')
    expect(err.status).toBe(403)
  })

  it("laisse passer un POST portant l'en-tete X-Requested-With", () => {
    const next = vi.fn()
    csrfProtection(fakeReq('POST', { 'x-requested-with': 'talkie-web' }), {} as Response, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('bloque aussi DELETE et PATCH sans en-tete', () => {
    for (const method of ['DELETE', 'PATCH', 'PUT']) {
      const next = vi.fn()
      csrfProtection(fakeReq(method), {} as Response, next)
      expect((next.mock.calls[0][0] as AppError).code).toBe('CSRF_REJECTED')
    }
  })
})
