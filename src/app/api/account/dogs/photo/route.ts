import { jsonError, jsonOk } from "@/lib/http";
import { bufferMatchesImageMime } from "@/lib/image-validation";
import { buildDogPhotoFileName, saveDogPhotoFile } from "@/lib/dog-photo-storage";
import { requireUser } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return jsonError("No image provided", 400);
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return jsonError("Invalid image type", 400);
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return jsonError("Image is too large after compression", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!bufferMatchesImageMime(buffer, file.type)) {
      return jsonError("Invalid image content", 400);
    }

    const fileName = buildDogPhotoFileName(user.id, file.type);
    await saveDogPhotoFile({ fileName, buffer });

    return jsonOk({
      image: {
        name: fileName,
        url: `/dogs/${fileName}`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Unable to upload dog photo", 500);
  }
}
