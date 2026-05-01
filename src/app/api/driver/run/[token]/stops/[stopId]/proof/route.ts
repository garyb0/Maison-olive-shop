import { bufferMatchesImageMime } from "@/lib/image-validation";
import {
  getDriverStopProofFile,
  mapDeliveryRunError,
  uploadDriverStopProof,
} from "@/lib/delivery-runs";
import { jsonError, jsonOk } from "@/lib/http";

type RouteContext = {
  params: Promise<{ token: string; stopId: string }>;
};

const validTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const maxProofSizeBytes = 3 * 1024 * 1024;

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token, stopId } = await context.params;
    const proof = await getDriverStopProofFile(token, stopId);

    return new Response(new Uint8Array(proof.buffer), {
      status: 200,
      headers: {
        "Content-Type": proof.mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token, stopId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return jsonError("No proof image provided", 400);
    }
    if (!validTypes.includes(file.type as (typeof validTypes)[number])) {
      return jsonError("Invalid proof image type", 400);
    }
    if (file.size > maxProofSizeBytes) {
      return jsonError("Proof image is too large", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!bufferMatchesImageMime(buffer, file.type)) {
      return jsonError("Invalid proof image content", 400);
    }

    const run = await uploadDriverStopProof(token, {
      stopId,
      buffer,
      mimeType: file.type,
      sizeBytes: file.size,
      lat: optionalNumber(formData.get("lat")),
      lng: optionalNumber(formData.get("lng")),
      accuracyMeters: optionalNumber(formData.get("accuracyMeters")),
      recordedAt: optionalString(formData.get("recordedAt")),
    });

    return jsonOk({
      run,
      proof: {
        stopId,
        uploaded: true,
      },
    });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
