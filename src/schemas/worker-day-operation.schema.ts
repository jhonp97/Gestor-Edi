import { z } from 'zod'

const segment = z.object({
  truckId: z.uuid(),
  share: z.number().int().min(1).max(100).optional(),
  kilometers: z.number().finite().min(0).max(1000000).optional(),
  incident: z.string().trim().min(1).max(1000).optional(),
}).strict()

export const workerDayOperationSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  segments: z.array(segment).min(1).max(2),
}).strict().superRefine((value, ctx) => {
  if (value.segments.length === 2 && !value.segments[0].incident) {
    ctx.addIssue({ code: 'custom', message: 'The broken truck requires an incident description', path: ['segments', 0, 'incident'] })
  }
  if (new Set(value.segments.map(s => s.truckId)).size !== value.segments.length) {
    ctx.addIssue({ code: 'custom', message: 'Trucks must be distinct', path: ['segments'] })
  }
  const shares = value.segments.map(s => s.share ?? (value.segments.length === 1 ? 100 : 50))
  if (shares.reduce((sum, share) => sum + share, 0) !== 100) {
    ctx.addIssue({ code: 'custom', message: 'Shares must total 100', path: ['segments'] })
  }
}).transform(value => ({
  companyName: value.companyName,
  segments: value.segments.map(s => ({ ...s, share: s.share ?? (value.segments.length === 1 ? 100 : 50) })),
}))

export type WorkerDayOperationInput = z.output<typeof workerDayOperationSchema>
