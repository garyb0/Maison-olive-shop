import { removeProductFavoriteForUser } from "@/lib/favorites";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const [user, params] = await Promise.all([requireUser(), context.params]);
    await removeProductFavoriteForUser(user.id, params.productId);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Unable to remove favorite", 500);
  }
}
