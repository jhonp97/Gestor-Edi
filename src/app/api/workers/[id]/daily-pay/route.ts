import { getUserFromRequest } from "@/lib/auth-edge";
import { accruedTotals, formatCivilDate, toMoney } from "@/lib/daily-pay";
import { DailyPayRepository } from "@/repositories/daily-pay.repository";
import { monthEnd } from "@/services/daily-pay.service";
import {
  periodStartQuerySchema,
  setDailyRateSchema,
} from "@/schemas/daily-pay.schema";
import type { CivilDate, DailyPayMonthDTO, Money } from "@/types/daily-pay";
import type { Worker } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/** JSON body that failed to parse: mapped to 400 before any schema runs. */
class InvalidBodyError extends Error {
  constructor() {
    super("Invalid JSON body");
    this.name = "InvalidBodyError";
  }
}

const UNAUTHORIZED = { error: "Unauthorized" };
const WORKER_NOT_FOUND = { error: "Worker not found" };
const INTERNAL_ERROR = { error: "Internal server error" };

function unauthorized(): Response {
  return Response.json(UNAUTHORIZED, { status: 401 });
}

function workerNotFound(): Response {
  return Response.json(WORKER_NOT_FOUND, { status: 404 });
}

function invalidBody(): Response {
  return Response.json({ error: "Invalid request body" }, { status: 400 });
}

/**
 * Sanitized catch-all: raw failures are logged server-side only, and the
 * response never carries exception text, database details, or credentials.
 */
function unexpected(error: unknown): Response {
  console.error("Daily-pay month route error:", error);
  return Response.json(INTERNAL_ERROR, { status: 500 });
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidBodyError();
  }
}

/** First Zod issue message; safe because the messages come from our schemas. */
function firstIssue(error: { issues: Array<{ message: string }> }): Response {
  return Response.json(
    { error: error.issues[0]?.message ?? "Invalid request" },
    { status: 400 },
  );
}

/**
 * Composes the accrued-only MonthDTO from immutable snapshots: the days of
 * the month, their exact sum, the worker's current rate, and the month
 * control (absent control reads as PENDING with no timestamp). Returns null
 * when the worker does not belong to the tenant, without any leak.
 */
async function buildMonthDto(
  repository: DailyPayRepository,
  workerId: string,
  periodStart: CivilDate,
  worker?: Worker | null,
): Promise<DailyPayMonthDTO | null> {
  return repository.runSerializable(async (tx: Prisma.TransactionClient) => {
    const resolved = worker ?? (await repository.findWorker(workerId));
    if (!resolved) return null;

    const from = periodStart;
    const to = monthEnd(periodStart);
    const [days, control] = await Promise.all([
      repository.listDays(workerId, from, to, tx),
      repository.findMonth(workerId, periodStart, tx),
    ]);

    const dayDtos = days.map((day) => ({
      date: formatCivilDate(day.workDate),
      rateSnapshot: toMoney(day.rateSnapshot),
    }));
    const dailyRate: Money | null =
      resolved.dailyRate === null ? null : toMoney(resolved.dailyRate);

    return {
      workerId,
      periodStart,
      dailyRate,
      status: control?.status ?? "PENDING",
      paidAt: control?.paidAt?.toISOString() ?? null,
      days: dayDtos,
      totals: accruedTotals(dayDtos.map((day) => day.rateSnapshot)),
    };
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.organizationId) return unauthorized();

    const { id } = await params;
    const query = periodStartQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) return firstIssue(query.error);

    const repository = new DailyPayRepository(user.organizationId);
    const month = await buildMonthDto(repository, id, query.data.periodStart);
    if (!month) return workerNotFound();
    return Response.json(month);
  } catch (error) {
    return unexpected(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.organizationId) return unauthorized();

    const { id } = await params;
    const query = periodStartQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) return firstIssue(query.error);

    const command = setDailyRateSchema.safeParse(await parseJsonBody(request));
    if (!command.success) return firstIssue(command.error);

    const repository = new DailyPayRepository(user.organizationId);
    const worker = await repository.setDailyRate(id, command.data.dailyRate);
    if (!worker) return workerNotFound();

    const month = await buildMonthDto(
      repository,
      id,
      query.data.periodStart,
      worker,
    );
    if (!month) return workerNotFound();
    return Response.json(month);
  } catch (error) {
    if (error instanceof InvalidBodyError) return invalidBody();
    return unexpected(error);
  }
}
