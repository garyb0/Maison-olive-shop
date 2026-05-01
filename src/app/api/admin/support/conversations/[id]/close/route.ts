import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { closeSupportConversation } from "@/lib/support";
import { adminSupportCloseSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = adminSupportCloseSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support close payload", 400);
    const conversation = await closeSupportConversation(id, admin, parsed.data);
    return jsonOk({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    return jsonError("Failed to close conversation", 500);
  }
}
