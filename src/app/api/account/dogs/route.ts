import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import {
  DogProfileAlreadyClaimedError,
  DogProfileNotFoundError,
  claimDogProfileForUser,
  getDogProfilesForUser,
} from "@/lib/dogs";
import { dogClaimSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireUser();
    const dogs = await getDogProfilesForUser(user.id);
    return jsonOk({ dogs });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Unable to fetch dogs", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const parsed = dogClaimSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid dog claim payload", 400);
    }

    const dog = await claimDogProfileForUser(user.id, parsed.data);
    return jsonOk({ dog });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof DogProfileNotFoundError) {
      return jsonError("Dog QR code not found", 404);
    }

    if (error instanceof DogProfileAlreadyClaimedError) {
      return jsonError("Dog QR code already claimed", 409);
    }

    return jsonError("Unable to claim dog QR code", 500);
  }
}
