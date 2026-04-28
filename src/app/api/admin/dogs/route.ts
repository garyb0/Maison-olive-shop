import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import {
  AdminDogProfileNotFoundError,
  createAdminDogTokenBatch,
  getAdminDogProfiles,
  updateDogProfileByAdmin,
} from "@/lib/dogs";
import { adminDogBatchCreateSchema, adminDogProfileUpdateSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireAdmin();
    const dogs = await getAdminDogProfiles();
    return jsonOk({ dogs });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }

    return jsonError("Unable to fetch dog QR tokens", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminDogProfileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid payload", 400);
    }

    const dog = await updateDogProfileByAdmin(parsed.data.dogId, parsed.data, admin.id);
    return jsonOk({ dog });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }

    if (error instanceof AdminDogProfileNotFoundError) {
      return jsonError("Dog token not found", 404);
    }

    return jsonError("Unable to update dog QR token", 500);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminDogBatchCreateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid payload", 400);
    }

    const dogs = await createAdminDogTokenBatch(parsed.data.count, admin.id);
    return jsonOk({ dogs });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }

    return jsonError("Unable to create dog QR tokens", 500);
  }
}
