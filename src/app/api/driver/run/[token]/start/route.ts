import { jsonError, jsonOk } from "@/lib/http";
import { mapDeliveryRunError, startDriverRun } from "@/lib/delivery-runs";
import { driverRunStartSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = driverRunStartSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return jsonError("Invalid run start payload", 400);
    }

    const run = await startDriverRun(token, parsed.data);
    return jsonOk({ run });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
