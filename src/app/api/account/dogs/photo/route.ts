import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";

const DOG_IMAGES_DIR = path.join(process.cwd(), "public", "dogs");

function extensionForType(type: string) {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return "jpg";
}

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

    const maxSize = 1.5 * 1024 * 1024;
    if (file.size > maxSize) {
      return jsonError("Image is too large after compression", 400);
    }

    await fs.mkdir(DOG_IMAGES_DIR, { recursive: true });

    const extension = extensionForType(file.type);
    const fileName = `${user.id}-${randomUUID()}.${extension}`;
    const filePath = path.join(DOG_IMAGES_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

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
