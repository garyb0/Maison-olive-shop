import { jsonError, jsonOk } from "@/lib/http";
import { reorderFromOrder } from "@/lib/orders";
import { requireUser } from "@/lib/permissions";
import { reorderSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = reorderSchema.parse(body);
    const order = await reorderFromOrder(input.orderId, user.id);
    return jsonOk({ order });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Unable to reorder", 400);
  }
}
