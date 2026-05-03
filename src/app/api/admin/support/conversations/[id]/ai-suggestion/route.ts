import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { generateSupportAiSuggestion, getSupportAiAvailability } from "@/lib/support-ai";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const suggestion = await generateSupportAiSuggestion(id, admin);
    return jsonOk({
      suggestion,
      availability: getSupportAiAvailability(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") return jsonError("Conversation not found", 404);
    if (error instanceof Error && error.message === "SUPPORT_AI_DISABLED") return jsonError("Support AI disabled", 409);
    if (error instanceof Error && error.message === "SUPPORT_AI_NOT_CONFIGURED") {
      return jsonError("Support AI not configured", 503);
    }
    if (error instanceof Error && error.message === "SUPPORT_AI_PROVIDER_UNSUPPORTED") {
      return jsonError("Support AI provider unsupported", 501);
    }
    if (
      error instanceof Error &&
      [
        "SUPPORT_AI_PROVIDER_FAILED",
        "SUPPORT_AI_REFUSED",
        "SUPPORT_AI_EMPTY_OUTPUT",
        "SUPPORT_AI_INCOMPLETE",
        "SUPPORT_AI_INVALID_OUTPUT",
      ].includes(error.message)
    ) {
      return jsonError("Support AI suggestion unavailable", 502);
    }
    return jsonError("Failed to generate support AI suggestion", 500);
  }
}
