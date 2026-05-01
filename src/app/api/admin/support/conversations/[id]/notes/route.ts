import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { addSupportInternalNote } from "@/lib/support";
import { adminSupportNoteCreateSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = adminSupportNoteCreateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support note payload", 400);
    const conversation = await addSupportInternalNote(id, admin, parsed.data.content);
    return jsonOk({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    return jsonError("Failed to add support note", 500);
  }
}
