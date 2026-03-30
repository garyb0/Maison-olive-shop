import { jsonError, jsonOk } from "@/lib/http";
import { getSupportConversationPublic } from "@/lib/support";

/**
 * Public endpoint — no auth required.
 * The UUID itself acts as a secret token (unguessable).
 * Used by guest users to poll their own conversation.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const conversation = await getSupportConversationPublic(id);
    if (!conversation) return jsonError("Conversation not found", 404);
    return jsonOk({ conversation });
  } catch {
    return jsonError("Failed to fetch conversation", 500);
  }
}
