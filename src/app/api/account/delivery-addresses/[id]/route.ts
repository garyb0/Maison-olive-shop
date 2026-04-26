import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import {
  DeliveryAddressDuplicateError,
  DeliveryAddressIncompleteError,
  DeliveryAddressOwnershipError,
  DeliveryAddressValidationError,
  deleteDeliveryAddressForUser,
  updateDeliveryAddressForUser,
} from "@/lib/delivery-addresses";
import { deliveryAddressPatchSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = deliveryAddressPatchSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid delivery address payload", 400);
    }

    const address = await updateDeliveryAddressForUser(user.id, id, parsed.data);
    return jsonOk({ address });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof DeliveryAddressOwnershipError) {
      return jsonError("Adresse de livraison introuvable", 404);
    }

    if (error instanceof DeliveryAddressValidationError) {
      return jsonError("Adresse hors zone de livraison", 400);
    }

    if (error instanceof DeliveryAddressIncompleteError || (error instanceof Error && error.message === "DELIVERY_ADDRESS_INCOMPLETE")) {
      return jsonError("Adresse incomplete. Rue, ville, region, code postal et pays sont requis.", 400);
    }

    if (error instanceof DeliveryAddressDuplicateError) {
      return jsonError("Cette adresse est déjà enregistrée. Utilise l’adresse existante ou modifie-la dans ton compte.", 409);
    }

    return jsonError("Unable to update delivery address", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    await deleteDeliveryAddressForUser(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof DeliveryAddressOwnershipError) {
      return jsonError("Adresse de livraison introuvable", 404);
    }

    return jsonError("Unable to delete delivery address", 500);
  }
}
