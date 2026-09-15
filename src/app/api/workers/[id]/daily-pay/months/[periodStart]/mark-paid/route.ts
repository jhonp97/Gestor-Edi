import { getUserFromRequest } from "@/lib/auth-edge";
import {
  DailyPayService,
  DailyPayEmptyMonthError,
  DailyPayMonthNotFoundError,
  DailyPayTransitionConflictError,
} from "@/services/daily-pay.service";
import {
  markPaidCommandSchema,
  periodStartSchema,
} from "@/schemas/daily-pay.schema";

/** JSON body that failed to parse: mapped to 400 before any schema runs. */
class InvalidBodyError extends Error {
  constructor() {
    super("Invalid JSON body");
    this.name = "InvalidBodyError";
  }
}

const UNAUTHORIZED = { error: "Unauthorized" };
const MONTH_NOT_FOUND = { error: "Daily-pay month not found" };
const EMPTY_MONTH = {
  error: "A month without worked days cannot be marked paid",
};
const TRANSITION_CONFLICT = {
  error: "Month transition conflict after the bounded retries",
};
const INTERNAL_ERROR = { error: "Internal server error" };

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
  console.error("Daily-pay mark-paid route error:", error);
  return Response.json(INTERNAL_ERROR, { status: 500 });
}

/**
 * Manual PAID transition. Every rule — the >=1 worked-day guard, the paidAt
 * stamp, the lock, the atomic audit, the idempotent same-state no-op, and
 * the bounded Serializable retry — lives in the application service; the
 * handler only validates the command and maps typed failures to statuses.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; periodStart: string }> },
): Promise<Response> {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.organizationId) return unauthorized();

    const { id, periodStart } = await params;
    const parsedPeriod = periodStartSchema.safeParse(periodStart);
    if (!parsedPeriod.success) return firstIssue(parsedPeriod.error);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new InvalidBodyError();
    }
    const command = markPaidCommandSchema.safeParse(rawBody);
    if (!command.success) return firstIssue(command.error);

    const service = new DailyPayService(user.organizationId);
    const result = await service.markPaid(id, parsedPeriod.data, {
      userId: user.userId,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof InvalidBodyError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (error instanceof DailyPayMonthNotFoundError) {
      return Response.json(MONTH_NOT_FOUND, { status: 404 });
    }
    if (error instanceof DailyPayEmptyMonthError) {
      return Response.json(EMPTY_MONTH, { status: 409 });
    }
    if (error instanceof DailyPayTransitionConflictError) {
      return Response.json(TRANSITION_CONFLICT, { status: 409 });
    }
    return unexpected(error);
  }
}
