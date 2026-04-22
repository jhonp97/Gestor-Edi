import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('User Profile Schema Extensions', () => {
  const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma')
  const schema = readFileSync(schemaPath, 'utf-8')

  it('debería tener el enum TwoFactorMethod con NONE y SMS', () => {
    expect(schema).toContain('enum TwoFactorMethod')
    expect(schema).toContain('NONE')
    expect(schema).toContain('SMS')
  })

  it('debería agregar phone (String?) al modelo User', () => {
    expect(schema).toContain('phone')
  })

  it('debería agregar phoneVerified (DateTime?) al modelo User', () => {
    expect(schema).toContain('phoneVerified')
  })

  it('debería agregar twoFactorEnabled (Boolean @default(false)) al modelo User', () => {
    expect(schema).toContain('twoFactorEnabled')
    expect(schema).toMatch(/twoFactorEnabled\s+Boolean\s+@default\(false\)/)
  })

  it('debería agregar twoFactorMethod (TwoFactorMethod @default(NONE)) al modelo User', () => {
    expect(schema).toContain('twoFactorMethod')
    expect(schema).toMatch(/twoFactorMethod\s+TwoFactorMethod\s+@default\(NONE\)/)
  })

  it('debería agregar language (String @default("es")) al modelo User', () => {
    expect(schema).toContain('language')
    expect(schema).toMatch(/language\s+String\s+@default\("es"\)/)
  })

  it('debería agregar notificationsEnabled (Boolean @default(true)) al modelo User', () => {
    expect(schema).toContain('notificationsEnabled')
    expect(schema).toMatch(/notificationsEnabled\s+Boolean\s+@default\(true\)/)
  })

  it('debería agregar emailNotifications (Boolean @default(true)) al modelo User', () => {
    expect(schema).toContain('emailNotifications')
    expect(schema).toMatch(/emailNotifications\s+Boolean\s+@default\(true\)/)
  })

  it('debería agregar smsNotifications (Boolean @default(false)) al modelo User', () => {
    expect(schema).toContain('smsNotifications')
    expect(schema).toMatch(/smsNotifications\s+Boolean\s+@default\(false\)/)
  })

  it('debería agregar gdprConsentGiven (Boolean @default(false)) al modelo User', () => {
    expect(schema).toContain('gdprConsentGiven')
    expect(schema).toMatch(/gdprConsentGiven\s+Boolean\s+@default\(false\)/)
  })

  it('debería agregar gdprConsentDate (DateTime?) al modelo User', () => {
    expect(schema).toContain('gdprConsentDate')
  })

  it('debería tener valores por defecto no destructivos para todos los campos nuevos', () => {
    // phone y phoneVerified son nullable sin default — OK
    // Los demás tienen default
    const userModelMatch = schema.match(/model User \{[\s\S]*?\n\}/)
    expect(userModelMatch).not.toBeNull()
    const userBlock = userModelMatch![0]
    expect(userBlock).toContain('phone                 String?')
    expect(userBlock).toContain('phoneVerified         DateTime?')
    expect(userBlock).toContain('twoFactorEnabled      Boolean             @default(false)')
    expect(userBlock).toContain('twoFactorMethod       TwoFactorMethod     @default(NONE)')
    expect(userBlock).toContain('language              String              @default("es")')
    expect(userBlock).toContain('notificationsEnabled  Boolean             @default(true)')
    expect(userBlock).toContain('emailNotifications    Boolean             @default(true)')
    expect(userBlock).toContain('smsNotifications      Boolean             @default(false)')
    expect(userBlock).toContain('gdprConsentGiven      Boolean             @default(false)')
    expect(userBlock).toContain('gdprConsentDate       DateTime?')
  })
})
