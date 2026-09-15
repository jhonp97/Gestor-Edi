import { getUserFromRequest } from "@/lib/auth-edge";
import { toMoney } from "@/lib/daily-pay";
import { DailyPayRepository } from "@/repositories/daily-pay.repository";
import { snapshotRate } from "@/lib/daily-pay";
import { civilDateSchema } from "@/schemas/daily-pay.schema";
import type { CivilDate, Money } from "@/types/daily-pay";
import type { Prisma } from "@prisma/client";

const UNAUTHORIZED = { error: "Unauthorized" };
const WORKER_NOT_FOUND = { error: "Worker not found" };
const DAY_NOT_FOUND = { error: "Worked day not found" };
const RATE_REQUIRED = { error: "A positive daily rate is required" };
const MONTH_LOCKED = { error: "Month is marked PAID; day edits are locked" };
const DAY_DUPLICATE = { error: "Worked day already marked for this date" };
const INTERNAL_ERROR = { error: "Internal server error" };

function unauthorized(): Response {
  return Response.json(UNAUTHORIZED, { status: 401 });
}

/**
 * Sanitized catch-all: raw failures are logged server-side only, and the
 * response never carries exception text, database details, or credentials.
 */
function unexpected(error: unknown): Response {
  console.error("Daily-pay day route error:", error);
  return Response.json(INTERNAL_ERROR, { status: 500 });
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null | undefined)?.code === "P2002";
}

/** First-of-month period start of a validated civil date. */
function periodStartOf(date: CivilDate): CivilDate {
  return `${date.slice(0, 7)}-01`;
}

/**
 * Marks an explicit worked day. The design flow runs inside one Serializable
 * transaction: lock the month control, conflict before writing when the month
 * is PAID, and snapshot the worker's currently configured rate — later rate
 * changes never alter this snapshot. A worker outside the tenant resolves as
 * not found; a duplicate civil date conflicts.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; date: string }> },
): Promise<Response> {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.organizationId) return unauthorized();

    const { id, date } = await params;
    const parsedDate = civilDateSchema.safeParse(date);
    if (!parsedDate.success) {
      return Response.json(
        { error: parsedDate.error.issues[0]?.message ?? "Invalid civil date" },
        { status: 400 },
      );
    }

    const repository = new DailyPayRepository(user.organizationId);
    const worker = await repository.findWorker(id);
    if (!worker) return Response.json(WORKER_NOT_FOUND, { status: 404 });

    // The rate must be configured and positive before any day can accrue; a
    // missing rate denies the mark without touching days or the lock.
    let rateSnapshot: Money;
    try {
      rateSnapshot = snapshotRate(
        worker.dailyRate === null ? null : toMoney(worker.dailyRate),
      );
    } catch {
      return Response.json(RATE_REQUIRED, { status: 409 });
    }

    return await repository.runSerializable(
      async (tx: Prisma.TransactionClient) => {
        const control = await repository.acquireMonthControl(
          id,
          periodStartOf(parsedDate.data),
          tx,
        );
        if (!control) return Response.json(WORKER_NOT_FOUND, { status: 404 });
        if (control.status === "PAID")
          return Response.json(MONTH_LOCKED, { status: 409 });

        try {
          await repository.createDay(id, parsedDate.data, rateSnapshot, tx);
        } catch (error) {
          if (isUniqueViolation(error))
            return Response.json(DAY_DUPLICATE, { status: 409 });
          throw error;
        }
        return Response.json(
          { date: parsedDate.data, rateSnapshot },
          { status: 201 },
        );
      },
    );
  } catch (error) {
    return unexpected(error);
  }
}

/**
 * Unmarks an explicit worked day inside the same Serializable flow: lock,
 * conflict on PAID, then delete. An unmarked date resolves as not found.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; date: string }> },
): Promise<Response> {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.organizationId) return unauthorized();

    const { id, date } = await params;
    const parsedDate = civilDateSchema.safeParse(date);
    if (!parsedDate.success) {
      return Response.json(
        { error: parsedDate.error.issues[0]?.message ?? "Invalid civil date" },
        { status: 400 },
      );
    }

    const repository = new DailyPayRepository(user.organizationId);
    return await repository.runSerializable(
      async (tx: Prisma.TransactionClient) => {
        const control = await repository.acquireMonthControl(
          id,
          periodStartOf(parsedDate.data),
          tx,
        );
        if (!control) return Response.json(WORKER_NOT_FOUND, { status: 404 });
        if (control.status === "PAID")
          return Response.json(MONTH_LOCKED, { status: 409 });

        const deleted = await repository.deleteDay(id, parsedDate.data, tx);
        if (deleted < 1) return Response.json(DAY_NOT_FOUND, { status: 404 });
        return new Response(null, { status: 204 });
      },
    );
  } catch (error) {
    return unexpected(error);
  }
}
