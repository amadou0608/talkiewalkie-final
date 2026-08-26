import jwt, { SignOptions } from 'jsonwebtoken'
import { env } from '../env'

export interface SessionPayload {
  userId: string
}

export function signSession(payload: SessionPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  }
  return jwt.sign(payload, env.jwtSecret, options)
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as SessionPayload
  } catch {
    return null
  }
}
