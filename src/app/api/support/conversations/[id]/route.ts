import { jsonError, jsonOk } from "@/lib/http";
import { getSupportConversationPublic } from "@/lib/support";

/**
 * Public endpoint — no auth required.
 * Guest access is restricted with a signed token.
 * Used by guest users to poll their own conversation.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(_request.url);
    const guestToken = url.searchParams.get("token")?.trim();
    if (!guestToken) return jsonError("Forbidden", 403);

    const conversation = await getSupportConversationPublic(id, guestToken);
    if (!conversation) return jsonError("Conversation not found", 404);
    return jsonOk({ conversation });
  } catch {
    return jsonError("Failed to fetch conversation", 500);
  }
}
