import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { getAdminSupportConversations } from "@/lib/support";

export async function GET() {
  try {
    await requireAdmin();
    const conversations = await getAdminSupportConversations();
    return jsonOk({ conversations });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Forbidden", 403);
  }
}
