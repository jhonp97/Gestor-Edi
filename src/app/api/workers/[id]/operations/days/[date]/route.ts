import { getUserFromRequest } from '@/lib/auth-edge'
import { civilDateSchema } from '@/schemas/daily-pay.schema'
import { workerDayOperationSchema } from '@/schemas/worker-day-operation.schema'
import { revalidatePath } from 'next/cache'
import { WorkerDayOperationError, WorkerDayOperationService } from '@/services/worker-day-operation.service'

type Context = { params: Promise<{ id: string; date: string }> }

async function prepare(request: Request, context: Context) {
  const user = await getUserFromRequest(request)
  if (!user?.organizationId) throw new WorkerDayOperationError(401, 'Unauthorized')
  const { id, date } = await context.params
  const parsed = civilDateSchema.safeParse(date)
  if (!parsed.success) throw new WorkerDayOperationError(400, 'Invalid civil date')
  return { service: new WorkerDayOperationService(user.organizationId), id, date: parsed.data }
}

function failure(error: unknown): Response {
  if (error instanceof WorkerDayOperationError) return Response.json({ error: error.message }, { status: error.status })
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'P2021' || code === 'P2022') {
    return Response.json({ error: 'Falta actualizar el esquema de la base de datos antes de guardar esta jornada' }, { status: 503 })
  }
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { service, id, date } = await prepare(request, context)
    return Response.json(await service.get(id, date))
  } catch (error) { return failure(error) }
}

export async function PUT(request: Request, context: Context): Promise<Response> {
  try {
    const { service, id, date } = await prepare(request, context)
    let body: unknown
    try { body = await request.json() } catch { throw new WorkerDayOperationError(400, 'Invalid JSON') }
    const parsed = workerDayOperationSchema.safeParse(body)
    if (!parsed.success) throw new WorkerDayOperationError(400, 'Invalid operational day')
    const operation = await service.put(id, date, parsed.data)
    for (const segment of operation.operation?.segments ?? []) revalidatePath(`/trucks/${segment.truckId}`)
    revalidatePath(`/workers/${id}`)
    return Response.json(operation)
  } catch (error) { return failure(error) }
}
