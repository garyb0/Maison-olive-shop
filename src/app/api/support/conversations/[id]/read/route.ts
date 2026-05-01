import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  markSupportConversationReadAsCustomer,
  markSupportConversationReadAsGuest,
} from "@/lib/support";
import { supportGuestReadSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = await applyRateLimit(request, { namespace: "support:read", windowMs: 60_000, max: 60 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await getCurrentUser();
    const { id } = await context.params;

    if (user) {
      if (user.role === "ADMIN") return jsonError("Forbidden", 403);
      const conversation = await markSupportConversationReadAsCustomer(id, user);
      return jsonOk({ conversation });
    }

    const body = await request.json().catch(() => null);
    const parsed = supportGuestReadSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support read payload", 400);

    const conversation = await markSupportConversationReadAsGuest(
      id,
      parsed.data.guestEmail,
      parsed.data.guestToken,
    );
    return jsonOk({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    return jsonError("Failed to mark support conversation as read", 500);
  }
}
