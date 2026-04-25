import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import { DogProfileOwnershipError, DogProfilePublicPhoneRequiredError, updateDogProfileForUser } from "@/lib/dogs";
import { dogProfilePatchSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = dogProfilePatchSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid dog profile payload", 400);
    }

    const dog = await updateDogProfileForUser(user.id, id, parsed.data);
    return jsonOk({ dog });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof DogProfileOwnershipError) {
      return jsonError("Dog profile not found", 404);
    }

    if (error instanceof DogProfilePublicPhoneRequiredError) {
      return jsonError("A phone number is required to enable the call button.", 400);
    }

    return jsonError("Unable to update dog profile", 500);
  }
}
