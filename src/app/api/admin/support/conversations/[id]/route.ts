import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { updateSupportConversationAsAdmin } from "@/lib/support";
import { adminSupportConversationPatchSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = adminSupportConversationPatchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support conversation payload", 400);
    const conversation = await updateSupportConversationAsAdmin(id, admin, parsed.data);
    return jsonOk({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") return jsonError("Order not found", 404);
    return jsonError("Failed to update support conversation", 500);
  }
}
