import { describe, it, expect } from 'vitest'
import {
  updateProfileSchema,
  changePasswordSchema,
  updatePreferencesSchema,
  phoneSchema,
} from '@/schemas/profile.schema'

describe('Profile Zod Schemas', () => {
  describe('updateProfileSchema', () => {
    it('debería validar nombre válido', () => {
      const result = updateProfileSchema.safeParse({ name: 'María' })
      expect(result.success).toBe(true)
    })

    it('debería rechazar nombre muy corto', () => {
      const result = updateProfileSchema.safeParse({ name: 'A' })
      expect(result.success).toBe(false)
    })

    it('debería validar teléfono en formato E.164', () => {
      const result = updateProfileSchema.safeParse({ phone: '+34612345678' })
      expect(result.success).toBe(true)
    })

    it('debería rechazar teléfono inválido', () => {
      const result = updateProfileSchema.safeParse({ phone: 'abc123' })
      expect(result.success).toBe(false)
    })

    it('debería validar imagen URL', () => {
      const result = updateProfileSchema.safeParse({ image: 'https://example.com/photo.jpg' })
      expect(result.success).toBe(true)
    })

    it('debería aceptar objeto vacío (campos opcionales)', () => {
      const result = updateProfileSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('changePasswordSchema', () => {
    it('debería validar cambio de contraseña correcto', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldPass123',
        newPassword: 'newPass456',
        confirmPassword: 'newPass456',
      })
      expect(result.success).toBe(true)
    })

    it('debería rechazar si newPassword tiene menos de 8 caracteres', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldPass123',
        newPassword: 'short',
        confirmPassword: 'short',
      })
      expect(result.success).toBe(false)
    })

    it('debería rechazar si confirmPassword no coincide', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldPass123',
        newPassword: 'newPass456',
        confirmPassword: 'different',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updatePreferencesSchema', () => {
    it('debería validar preferencias completas', () => {
      const result = updatePreferencesSchema.safeParse({
        language: 'en',
        notificationsEnabled: false,
        emailNotifications: false,
        smsNotifications: true,
      })
      expect(result.success).toBe(true)
    })

    it('debería rechazar lenguaje inválido', () => {
      const result = updatePreferencesSchema.safeParse({ language: 'fr' })
      expect(result.success).toBe(false)
    })

    it('debería aceptar objeto vacío', () => {
      const result = updatePreferencesSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('phoneSchema', () => {
    it('debería validar teléfono E.164', () => {
      expect(phoneSchema.safeParse('+34612345678').success).toBe(true)
    })

    it('debería rechazar teléfono sin +', () => {
      expect(phoneSchema.safeParse('34612345678').success).toBe(false)
    })

    it('debería rechazar teléfono muy corto', () => {
      expect(phoneSchema.safeParse('+123').success).toBe(false)
    })
  })
})
