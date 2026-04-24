import { jsonError, jsonOk } from "@/lib/http";
import { finishDriverRun, mapDeliveryRunError } from "@/lib/delivery-runs";
import { driverFinishRunSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = driverFinishRunSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return jsonError("Invalid finish payload", 400);
    }

    const run = await finishDriverRun(token, parsed.data);
    return jsonOk({ run });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
