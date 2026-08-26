// Test d'integration au niveau HTTP (supertest), service mocke : verifie le
// cablage reel (middlewares, validation Zod, codes de statut, cookie de
// session) sans dependre d'une vraie base Postgres. Complement des tests
// unitaires de auth.service.test.ts, qui couvrent la logique metier elle-meme.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'

vi.mock('./auth.service', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  findById: vi.fn(),
  deleteAccount: vi.fn(),
}))
vi.mock('../../realtime/socket', () => ({
  disconnectUserSockets: vi.fn(),
  forceOffline: vi.fn(),
}))

import { authRouter } from './auth.routes'
import { csrfProtection } from '../../middleware/csrfProtection'
import { errorHandler } from '../../middleware/errorHandler'
import { AppError } from '../../utils/AppError'
import { registerUser, loginUser } from './auth.service'

const mockedRegister = vi.mocked(registerUser)
const mockedLogin = vi.mocked(loginUser)

function buildApp() {
  const app = express()
  app.use(cookieParser())
  app.use(express.json())
  app.use(csrfProtection)
  app.use('/auth', authRouter)
  app.use(errorHandler)
  return app
}

const fakePublicUser = {
  id: 'user-1',
  username: 'moussa123',
  displayName: 'Moussa',
  avatarColor: '#000',
  status: 'online' as const,
  lastSeen: 'en ligne',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /auth/register', () => {
  it("refuse une requete sans en-tete X-Requested-With (CSRF, section 13)", async () => {
    const res = await request(buildApp())
      .post('/auth/register')
      .send({ displayName: 'Moussa', username: 'moussa123', password: 'motdepasse123' })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('CSRF_REJECTED')
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('refuse un corps invalide (validation Zod)', async () => {
    const res = await request(buildApp())
      .post('/auth/register')
      .set('X-Requested-With', 'talkie-web')
      .send({ displayName: '', username: 'x', password: '123' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('inscrit un utilisateur valide et pose le cookie de session', async () => {
    mockedRegister.mockResolvedValue(fakePublicUser)

    const res = await request(buildApp())
      .post('/auth/register')
      .set('X-Requested-With', 'talkie-web')
      .send({ displayName: 'Moussa', username: 'moussa123', password: 'motdepasse123' })

    expect(res.status).toBe(201)
    expect(res.body.user.username).toBe('moussa123')
    expect(res.body.user).not.toHaveProperty('password_hash')
    expect(res.headers['set-cookie']?.[0]).toMatch(/talkie_session=/)
  })
})

describe('POST /auth/login', () => {
  it("renvoie INVALID_CREDENTIALS (401) sans reveler si l'identifiant existe", async () => {
    mockedLogin.mockRejectedValue(
      new AppError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.', 401),
    )

    const res = await request(buildApp())
      .post('/auth/login')
      .set('X-Requested-With', 'talkie-web')
      .send({ username: 'inconnu', password: 'peu-importe' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('GET /auth/me', () => {
  it('renvoie 401 sans cookie de session', async () => {
    const res = await request(buildApp()).get('/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('UNAUTHENTICATED')
  })
})
