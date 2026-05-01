import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { createSupportQuickReply, listSupportQuickReplies } from "@/lib/support";
import { adminSupportQuickReplyCreateSchema } from "@/lib/validators";

function parseLanguage(url: string) {
  const language = new URL(url).searchParams.get("language");
  return language === "en" ? "en" : "fr";
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const quickReplies = await listSupportQuickReplies(parseLanguage(request.url));
    return jsonOk({ quickReplies });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    return jsonError("Failed to load support quick replies", 500);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminSupportQuickReplyCreateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid support quick reply payload", 400);
    const quickReply = await createSupportQuickReply(admin, parsed.data);
    return jsonOk({ quickReply }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    return jsonError("Failed to create support quick reply", 500);
  }
}
