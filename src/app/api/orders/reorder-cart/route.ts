import { jsonError, jsonOk } from "@/lib/http";
import { buildReorderCart } from "@/lib/orders";
import { requireUser } from "@/lib/permissions";
import { reorderCartSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = reorderCartSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid reorder payload", 400);

    const result = await buildReorderCart(parsed.data.orderId, user.id);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return jsonError("Order not found", 404);
    }

    return jsonError("Unable to prepare reorder cart", 500);
  }
}
