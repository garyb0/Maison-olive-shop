import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  closeSupportConversationAsCustomer,
  closeSupportConversationAsGuest,
} from "@/lib/support";
import { supportConversationCloseSchema, supportGuestCloseSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = await applyRateLimit(request, { namespace: "support:close", windowMs: 60_000, max: 20 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (user) {
      if (user.role === "ADMIN") return jsonError("Forbidden", 403);
      const parsed = supportConversationCloseSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid support close payload", 400);
      const conversation = await closeSupportConversationAsCustomer(id, user, parsed.data);
      return jsonOk({ conversation });
    }

    const parsed = supportGuestCloseSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support close payload", 400);
    const conversation = await closeSupportConversationAsGuest(
      id,
      parsed.data.guestEmail,
      parsed.data.guestToken,
      parsed.data,
    );
    return jsonOk({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    return jsonError("Failed to close support conversation", 500);
  }
}
