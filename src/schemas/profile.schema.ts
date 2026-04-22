import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100).optional(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Formato de teléfono inválido').optional(),
  image: z.string().url('URL de imagen inválida').optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

export const updatePreferencesSchema = z.object({
  language: z.enum(['es', 'en']).optional(),
  notificationsEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
})

export const phoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Formato de teléfono inválido')

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>
