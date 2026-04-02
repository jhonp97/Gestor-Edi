import { Resend } from 'resend'

let resendInstance: Resend | null = null

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY not configured - emails will not be sent')
    return null
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Flota Camiones'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export class EmailService {
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    try {
      const resend = getResend()
      if (!resend) {
        console.log(`📧 [DEV] Welcome email skipped for ${to} (no API key)`)
        return true // Return true to not block registration
      }
      await resend.emails.send({
        from: `${APP_NAME} <onboarding@resend.dev>`,
        to,
        subject: `¡Bienvenido a ${APP_NAME}!`,
        html: this.getWelcomeTemplate(name),
      })
      return true
    } catch (error) {
      console.error('Error sending welcome email:', error)
      return false
    }
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
    try {
      const resend = getResend()
      if (!resend) {
        console.log(`📧 [DEV] Password reset email skipped for ${to} (no API key)`)
        console.log(`📧 [DEV] Reset token: ${token}`)
        return true // Return true to not block password reset
      }
      const resetUrl = `${APP_URL}/reset-password?token=${token}`
      await resend.emails.send({
        from: `${APP_NAME} <onboarding@resend.dev>`,
        to,
        subject: `Restablecer contraseña - ${APP_NAME}`,
        html: this.getPasswordResetTemplate(name, resetUrl),
      })
      return true
    } catch (error) {
      console.error('Error sending password reset email:', error)
      return false
    }
  }

  private getWelcomeTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #1e3a5f; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${APP_NAME}</h1>
          </div>
          <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1e3a5f; margin-top: 0;">¡Hola ${name}!</h2>
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              ¡Bienvenido a ${APP_NAME}! Tu cuenta ha sido creada exitosamente.
            </p>
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              Ya podés empezar a gestionar tu flota:
            </p>
            <ul style="color: #555555; font-size: 16px; line-height: 1.8;">
              <li>Registrar camiones</li>
              <li>Controlar transacciones</li>
              <li>Gestionar trabajadores</li>
              <li>Generar nóminas</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/dashboard" style="background-color: #1e3a5f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">
                Ir al Dashboard
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
            <p style="color: #999999; font-size: 14px; text-align: center;">
              Este es un email automático, por favor no respondas a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private getPasswordResetTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #1e3a5f; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${APP_NAME}</h1>
          </div>
          <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1e3a5f; margin-top: 0;">Hola ${name},</h2>
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              Recibimos una solicitud para restablecer tu contraseña.
            </p>
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              Hacé clic en el botón de abajo para crear una nueva contraseña:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #1e3a5f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">
                Restablecer Contraseña
              </a>
            </div>
            <p style="color: #999999; font-size: 14px; line-height: 1.6;">
              Este enlace expirará en 1 hora. Si no solicitaste este cambio, podés ignorar este email.
            </p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
            <p style="color: #999999; font-size: 14px; text-align: center;">
              Este es un email automático, por favor no respondas a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export const emailService = new EmailService()
