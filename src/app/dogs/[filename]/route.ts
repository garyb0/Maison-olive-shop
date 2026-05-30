import { promises as fs } from "node:fs";
import { resolveDogPhotoFile } from "@/lib/dog-photo-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DogPhotoRouteContext = {
  params: Promise<{ filename: string }>;
};

const notFoundResponse = () =>
  new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

async function getDogPhoto(context: DogPhotoRouteContext) {
  const { filename } = await context.params;
  return resolveDogPhotoFile(filename.trim());
}

export async function GET(_request: Request, context: DogPhotoRouteContext) {
  const image = await getDogPhoto(context);
  if (!image) return notFoundResponse();

  const buffer = await fs.readFile(image.filePath);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(image.size),
      "Content-Type": image.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(_request: Request, context: DogPhotoRouteContext) {
  const image = await getDogPhoto(context);
  if (!image) return notFoundResponse();

  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(image.size),
      "Content-Type": image.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
