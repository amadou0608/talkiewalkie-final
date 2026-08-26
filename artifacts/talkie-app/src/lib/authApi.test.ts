import { describe, expect, it } from 'vitest'
import { validatePassword, validateUsername } from './authApi'

describe('validateUsername', () => {
  it('accepte un identifiant valide, avec ou sans @', () => {
    expect(validateUsername('moussa123')).toBeNull()
    expect(validateUsername('@moussa123')).toBeNull()
  })

  it('accepte les majuscules en les normalisant (pas d\'erreur)', () => {
    expect(validateUsername('Moussa123')).toBeNull()
  })

  it('refuse un identifiant trop court', () => {
    expect(validateUsername('ab')).toMatchObject({ code: 'INVALID_USERNAME' })
  })

  it('refuse les caracteres non autorises (espace, symboles)', () => {
    expect(validateUsername('moussa 123')).toMatchObject({ code: 'INVALID_USERNAME' })
    expect(validateUsername('moussa!123')).toMatchObject({ code: 'INVALID_USERNAME' })
  })
})

describe('validatePassword', () => {
  it('accepte un mot de passe de 8 caracteres ou plus', () => {
    expect(validatePassword('motdepasse')).toBeNull()
  })

  it('refuse un mot de passe trop court', () => {
    expect(validatePassword('court12')).toMatchObject({ code: 'WEAK_PASSWORD' })
  })
})
