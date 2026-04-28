import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import {
  DeliveryAddressDuplicateError,
  DeliveryAddressIncompleteError,
  DeliveryAddressLimitError,
  DeliveryAddressValidationError,
  MAX_DELIVERY_ADDRESSES_PER_USER,
  createDeliveryAddressForUser,
  getDeliveryAddressesForUser,
} from "@/lib/delivery-addresses";
import { deliveryAddressUpsertSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireUser();
    const addresses = await getDeliveryAddressesForUser(user.id);
    return jsonOk({ addresses });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Unable to fetch delivery addresses", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const parsed = deliveryAddressUpsertSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid delivery address payload", 400);
    }

    const address = await createDeliveryAddressForUser(user.id, parsed.data);
    return jsonOk({ address });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
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

    if (error instanceof DeliveryAddressLimitError) {
      return jsonError(`Tu peux enregistrer jusqu'à ${MAX_DELIVERY_ADDRESSES_PER_USER} adresses maximum.`, 409);
    }

    return jsonError("Unable to create delivery address", 500);
  }
}
