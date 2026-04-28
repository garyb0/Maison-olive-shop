import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { applyRateLimit } from "@/lib/rate-limit";
import { createSupportConversation, createSupportGuestAccessToken } from "@/lib/support";
import { supportConversationCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "support:create-conversation", windowMs: 60_000, max: 8 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const parsed = supportConversationCreateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support conversation payload", 400);
    const conversation = await createSupportConversation({
      user,
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
    });
    const guestAccessToken = !user
      ? createSupportGuestAccessToken(conversation.id, conversation.customerEmail)
      : undefined;
    return jsonOk({ conversation, guestAccessToken });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "MISSING_GUEST_DETAILS") return jsonError("Guest name and email are required", 400);
    return jsonError("Failed to create support conversation", 500);
  }
}
