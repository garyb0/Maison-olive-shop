import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { applyRateLimit } from "@/lib/rate-limit";
import { createSupportMessageAsCustomer, createSupportMessageAsGuest } from "@/lib/support";
import { supportGuestMessageCreateSchema, supportMessageCreateSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = applyRateLimit(request, { namespace: "support:message", windowMs: 60_000, max: 30 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const body = await request.json();

    if (user) {
      // Authenticated customer
      if (user.role === "ADMIN") return jsonError("Forbidden", 403);
      const parsed = supportMessageCreateSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid support message payload", 400);
      const conversation = await createSupportMessageAsCustomer(id, user, parsed.data.content);
      return jsonOk({ conversation });
    } else {
      // Guest — requires guestEmail for verification
      const parsed = supportGuestMessageCreateSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid support message payload", 400);
      const conversation = await createSupportMessageAsGuest(id, parsed.data.guestEmail, parsed.data.content);
      return jsonOk({ conversation });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    if (error instanceof Error && error.message === "CONVERSATION_CLOSED") return jsonError("Conversation closed", 409);
    return jsonError("Failed to send support message", 500);
  }
}
