import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGES_DIR = path.join(process.cwd(), "public", "Logo");
const ALLOWED_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+\.(png|jpe?g|gif|webp)$/i;
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type ImageRouteContext = {
  params: Promise<{ filename: string }>;
};

const buildNotFoundResponse = () =>
  new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

async function resolvePublicLogoImage(context: ImageRouteContext) {
  const { filename: rawFilename } = await context.params;
  const filename = rawFilename.trim();

  if (!ALLOWED_FILENAME_PATTERN.test(filename) || filename !== path.basename(filename)) {
    return null;
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = IMAGE_MIME_BY_EXT[ext];
  if (!contentType) return null;

  const imagePath = path.normalize(path.join(IMAGES_DIR, filename));
  const imageRoot = `${path.normalize(IMAGES_DIR)}${path.sep}`;
  if (!imagePath.startsWith(imageRoot)) return null;

  try {
    const stat = await fs.stat(imagePath);
    if (!stat.isFile()) return null;

    return { contentType, imagePath, size: stat.size };
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: ImageRouteContext) {
  const image = await resolvePublicLogoImage(context);
  if (!image) return buildNotFoundResponse();

  const buffer = await fs.readFile(image.imagePath);

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

export async function HEAD(_request: Request, context: ImageRouteContext) {
  const image = await resolvePublicLogoImage(context);
  if (!image) return buildNotFoundResponse();

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
