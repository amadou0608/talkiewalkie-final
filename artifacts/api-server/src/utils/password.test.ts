import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password utils', () => {
  it('hashe un mot de passe sans jamais le stocker en clair', async () => {
    const hash = await hashPassword('un-mot-de-passe-solide')
    expect(hash).not.toBe('un-mot-de-passe-solide')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('verifie correctement un mot de passe valide', async () => {
    const hash = await hashPassword('un-mot-de-passe-solide')
    await expect(verifyPassword('un-mot-de-passe-solide', hash)).resolves.toBe(true)
  })

  it('rejette un mot de passe incorrect', async () => {
    const hash = await hashPassword('un-mot-de-passe-solide')
    await expect(verifyPassword('mauvais-mot-de-passe', hash)).resolves.toBe(false)
  })

  it('produit un hash different a chaque appel (salage)', async () => {
    const hashA = await hashPassword('meme-mot-de-passe')
    const hashB = await hashPassword('meme-mot-de-passe')
    expect(hashA).not.toBe(hashB)
  })
})
