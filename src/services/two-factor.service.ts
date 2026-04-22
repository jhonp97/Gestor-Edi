import twilio from 'twilio'
import bcrypt from 'bcryptjs'
import { UserProfileRepository } from '@/repositories/user-profile.repository'
import { TwoFactorError } from '@/lib/errors'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID

export class TwoFactorService {
  private repo = new UserProfileRepository()
  private client: twilio.Twilio | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private verificationService: any = null

  constructor() {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID) {
      this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
      this.verificationService = this.client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
    }
  }

  async sendCode(userId: string): Promise<{ status: string }> {
    const user = await this.repo.findById(userId)
    if (!user?.phone || !user.phoneVerified) {
      throw new TwoFactorError('Teléfono no verificado. Verificá tu número antes de habilitar 2FA.')
    }

    if (!this.verificationService) {
      throw new TwoFactorError('Servicio de verificación no configurado')
    }

    await this.verificationService.verifications.create({ to: user.phone, channel: 'sms' })
    return { status: 'code_sent' }
  }

  async verifyCode(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.repo.findById(userId)
    if (!user?.phone) {
      throw new TwoFactorError('Teléfono no configurado')
    }

    if (!this.verificationService) {
      throw new TwoFactorError('Servicio de verificación no configurado')
    }

    const check = await this.verificationService.verificationChecks.create({
      to: user.phone,
      code,
    })

    if (check.status !== 'approved') {
      throw new TwoFactorError('Código inválido')
    }

    await this.repo.updateProfile(userId, { twoFactorEnabled: true, twoFactorMethod: 'SMS' })
    return { enabled: true }
  }

  async disable(userId: string, password: string): Promise<{ enabled: boolean }> {
    const user = await this.repo.findById(userId)
    if (!user) {
      throw new TwoFactorError('Usuario no encontrado')
    }

    if (!user.password) {
      throw new TwoFactorError('Autenticación por Google — no se puede deshabilitar 2FA con contraseña')
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw new TwoFactorError('Contraseña incorrecta')
    }

    await this.repo.updateProfile(userId, { twoFactorEnabled: false, twoFactorMethod: 'NONE' })
    return { enabled: false }
  }
}

export const twoFactorService = new TwoFactorService()
