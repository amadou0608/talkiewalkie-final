// Hachage de mots de passe — section 13 du cahier des charges.
// bcryptjs (implementation pure JS, pas de compilation native requise :
// plus simple a deployer sur un MVP) avec un cout de 12, un bon compromis
// securite/latence pour un premier lancement.
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
