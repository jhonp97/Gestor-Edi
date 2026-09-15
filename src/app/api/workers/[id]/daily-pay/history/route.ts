import { getUserFromRequest } from "@/lib/auth-edge";
import { annualHistoryMonths } from "@/lib/daily-pay";
import { DailyPayRepository } from "@/repositories/daily-pay.repository";
import { monthEnd } from "@/services/daily-pay.service";
import { historyYearQuerySchema } from "@/schemas/daily-pay.schema";
import type { CivilDate, DailyPayHistoryMonthDTO } from "@/types/daily-pay";
import type { Prisma } from "@prisma/client";

const UNAUTHORIZED = { error: "Unauthorized" };
const WORKER_NOT_FOUND = { error: "Worker not found" };
const INTERNAL_ERROR = { error: "Internal server error" };

const MONTHS_PER_YEAR = 12;

function unauthorized(): Response {
  return Response.json(UNAUTHORIZED, { status: 401 });
}

function firstIssue(error: { issues: Array<{ message: string }> }): Response {
  return Response.json(
    { error: error.issues[0]?.message ?? "Invalid request" },
    { status: 400 },
  );
}

/**
 * Sanitized catch-all: raw failures are logged server-side only, and the
 * response never carries exception text, database details, or credentials.
 */
function unexpected(error: unknown): Response {
  console.error("Daily-pay history route error:", error);
  return Response.json(INTERNAL_ERROR, { status: 500 });
}

function pad2(part: number): string {
  return String(part).padStart(2, "0");
}

/**
 * Informational annual history: each month exposes status, paidAt, and the
 * exact accrued sum of its snapshots. Months without a control row are
 * synthesized as PENDING/null/0.00 by the shared helper — never written.
 * The composition runs in one Serializable snapshot so the twelve entries
 * describe a single consistent state.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.organizationId) return unauthorized();

    const { id } = await params;
    const query = historyYearQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) return firstIssue(query.error);

    const repository = new DailyPayRepository(user.organizationId);
    const worker = await repository.findWorker(id);
    if (!worker) return Response.json(WORKER_NOT_FOUND, { status: 404 });

    const year = Number(query.data.year);
    const present = await repository.runSerializable(
      async (
        tx: Prisma.TransactionClient,
      ): Promise<DailyPayHistoryMonthDTO[]> => {
        const entries: DailyPayHistoryMonthDTO[] = [];
        for (let index = 1; index <= MONTHS_PER_YEAR; index += 1) {
          const periodStart: CivilDate = `${query.data.year}-${pad2(index)}-01`;
          const [control, aggregate] = await Promise.all([
            repository.findMonth(id, periodStart, tx),
            repository.aggregateWorkedDays(
              id,
              periodStart,
              monthEnd(periodStart),
              tx,
            ),
          ]);
          if (control) {
            entries.push({
              periodStart,
              status: control.status,
              paidAt: control.paidAt?.toISOString() ?? null,
              accrued: aggregate.accrued,
            });
          }
        }
        return entries;
      },
    );

    return Response.json({ year, months: annualHistoryMonths(year, present) });
  } catch (error) {
    return unexpected(error);
  }
}
