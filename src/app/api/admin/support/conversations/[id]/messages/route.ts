import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { createSupportMessageAsAdmin } from "@/lib/support";
import { supportMessageCreateSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = supportMessageCreateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support message payload", 400);
    const conversation = await createSupportMessageAsAdmin(id, admin, parsed.data.content);
    return jsonOk({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    if (error instanceof Error && error.message === "CONVERSATION_CLOSED") return jsonError("Conversation closed", 409);
    return jsonError("Failed to send admin support message", 500);
  }
}
