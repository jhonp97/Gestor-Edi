import { z } from 'zod'

export const ConsentCategoriesSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
})

export const ConsentInputSchema = z.object({
  categories: ConsentCategoriesSchema,
})

export type ConsentInput = z.infer<typeof ConsentInputSchema>
export type ConsentCategories = z.infer<typeof ConsentCategoriesSchema>
