import { jsonError, jsonOk } from "@/lib/http";
import { mapDeliveryRunError, optimizeDriverRunFromCurrentPosition } from "@/lib/delivery-runs";
import { driverRunOptimizeSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = driverRunOptimizeSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid run optimization payload", 400);
    }

    const result = await optimizeDriverRunFromCurrentPosition(token, parsed.data);
    return jsonOk(result);
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
