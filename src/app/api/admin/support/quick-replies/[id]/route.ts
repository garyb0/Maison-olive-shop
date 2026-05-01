import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { updateSupportQuickReply } from "@/lib/support";
import { adminSupportQuickReplyPatchSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = adminSupportQuickReplyPatchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support quick reply payload", 400);
    const quickReply = await updateSupportQuickReply(id, admin, parsed.data);
    return jsonOk({ quickReply });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "QUICK_REPLY_NOT_FOUND") return jsonError("Quick reply not found", 404);
    return jsonError("Failed to update support quick reply", 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const quickReply = await updateSupportQuickReply(id, admin, { isActive: false });
    return jsonOk({ quickReply });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "QUICK_REPLY_NOT_FOUND") return jsonError("Quick reply not found", 404);
    return jsonError("Failed to delete support quick reply", 500);
  }
}
