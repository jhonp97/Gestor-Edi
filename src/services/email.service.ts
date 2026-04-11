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

// En plan gratuito de Resend sin dominio verificado,
// solo se puede enviar al email de la cuenta de Resend.
// Cuando tengas dominio verificado, añade RESEND_VERIFIED_DOMAIN en .env
// y el FROM_EMAIL con tu dominio, y los emails irán directamente al usuario.
const ADMIN_EMAIL_RESEND = process.env.ADMIN_EMAIL_RESEND || ''
const HAS_VERIFIED_DOMAIN = !!process.env.RESEND_VERIFIED_DOMAIN
const FROM_EMAIL = HAS_VERIFIED_DOMAIN
  ? `${APP_NAME} <noreply@${process.env.RESEND_VERIFIED_DOMAIN}>`
  : `${APP_NAME} <onboarding@resend.dev>`

export class EmailService {

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    try {
      const resend = getResend()
      if (!resend) {
        console.log(`📧 [DEV] Welcome email skipped for ${to} (no API key)`)
        return true
      }

      // Sin dominio verificado → enviar notificación al admin en lugar del usuario
      const recipient = HAS_VERIFIED_DOMAIN ? to : ADMIN_EMAIL_RESEND
      if (!recipient) {
        console.warn('📧 No recipient available — set ADMIN_EMAIL_RESEND in env')
        return true
      }

      const subject = HAS_VERIFIED_DOMAIN
        ? `¡Bienvenido a ${APP_NAME}!`
        : `[Nuevo registro] ${name} — ${to}`

      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient,
        subject,
        html: this.getWelcomeTemplate(name, to),
      })

      console.log(`📧 Welcome email enviado a: ${recipient}`)
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
        return true
      }

      const resetUrl = `${APP_URL}/reset-password?token=${token}`

      // Sin dominio verificado → enviar al admin con el link para que lo reenvíe
      const recipient = HAS_VERIFIED_DOMAIN ? to : ADMIN_EMAIL_RESEND
      if (!recipient) {
        console.warn('📧 No recipient available — set ADMIN_EMAIL_RESEND in env')
        return true
      }

      const subject = HAS_VERIFIED_DOMAIN
        ? `Restablecer contraseña — ${APP_NAME}`
        : `[Reset password] ${name} (${to})`

      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient,
        subject,
        html: HAS_VERIFIED_DOMAIN
          ? this.getPasswordResetTemplate(name, resetUrl)
          : this.getAdminPasswordResetTemplate(name, to, resetUrl),
      })

      console.log(`📧 Password reset email enviado a: ${recipient}`)
      return true
    } catch (error) {
      console.error('Error sending password reset email:', error)
      return false
    }
  }

  // Template de bienvenida — para el usuario (con dominio) o el admin (sin dominio)
  private getWelcomeTemplate(name: string, userEmail?: string): string {
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
            ${!HAS_VERIFIED_DOMAIN && userEmail ? `
              <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>Notificación de admin:</strong> Nuevo usuario registrado — <strong>${name}</strong> (${userEmail})
                </p>
              </div>
            ` : ''}
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

  // Template reset para el usuario (con dominio verificado)
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
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #1e3a5f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">
                Restablecer Contraseña
              </a>
            </div>
            <p style="color: #999999; font-size: 14px; line-height: 1.6;">
              Este enlace expirará en 1 hora. Si no solicitaste este cambio, ignorá este email.
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

  // Template reset para el admin (sin dominio verificado)
  // El admin recibe el link y lo reenvía manualmente al usuario
  private getAdminPasswordResetTemplate(name: string, userEmail: string, resetUrl: string): string {
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
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${APP_NAME} — Admin</h1>
          </div>
          <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Acción requerida:</strong> El usuario <strong>${name}</strong> (${userEmail}) solicitó restablecer su contraseña. Reenvía este link manualmente.
              </p>
            </div>
            <h2 style="color: #1e3a5f; margin-top: 0;">Solicitud de reset de contraseña</h2>
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              Usuario: <strong>${name}</strong><br/>
              Email: <strong>${userEmail}</strong>
            </p>
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              Link para restablecer contraseña (expira en 1 hora):
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #1e3a5f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">
                Link de Reset
              </a>
            </div>
            <p style="color: #999999; font-size: 13px; word-break: break-all;">
              URL: ${resetUrl}
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export const emailService = new EmailService()