import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DOG_PHOTOS_DIR = path.join(process.cwd(), "storage", "dog-photos");
const LEGACY_DOG_PHOTOS_DIR = path.join(process.cwd(), "public", "dogs");
const SAFE_DOG_PHOTO_NAME = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/i;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safeResolve(root: string, fileName: string) {
  if (!SAFE_DOG_PHOTO_NAME.test(fileName) || fileName !== path.basename(fileName)) {
    return null;
  }

  const fullPath = path.resolve(root, fileName);
  const resolvedRoot = path.resolve(root);

  if (!fullPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }

  return fullPath;
}

export function getDogPhotoExtension(mimeType: string) {
  return EXTENSION_BY_MIME[mimeType] ?? null;
}

export function buildDogPhotoFileName(userId: string, mimeType: string) {
  const extension = getDogPhotoExtension(mimeType);
  if (!extension) {
    throw new Error("DOG_PHOTO_TYPE_INVALID");
  }

  return `${userId}-${randomUUID()}.${extension}`;
}

export async function saveDogPhotoFile(input: { fileName: string; buffer: Buffer }) {
  const filePath = safeResolve(DOG_PHOTOS_DIR, input.fileName);
  if (!filePath) {
    throw new Error("DOG_PHOTO_NAME_INVALID");
  }

  await fs.mkdir(DOG_PHOTOS_DIR, { recursive: true });
  await fs.writeFile(filePath, input.buffer);
  return input.fileName;
}

export async function resolveDogPhotoFile(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  const contentType = MIME_BY_EXTENSION[extension];
  if (!contentType) return null;

  const storagePath = safeResolve(DOG_PHOTOS_DIR, fileName);
  const legacyPath = safeResolve(LEGACY_DOG_PHOTOS_DIR, fileName);
  const candidates = [storagePath, legacyPath].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        return {
          contentType,
          filePath,
          size: stat.size,
        };
      }
    } catch {
      // Try the next location.
    }
  }

  return null;
}
