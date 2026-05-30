"use client";

type OutputImageType = "image/webp" | "image/jpeg";

export type ImageCompressionOptions = {
  fileNamePrefix?: string;
  initialQuality?: number;
  maxDimension?: number;
  minDimension?: number;
  minQuality?: number;
  outputType?: OutputImageType;
  targetMaxBytes?: number;
};

const DEFAULT_INITIAL_QUALITY = 0.78;
const DEFAULT_MAX_DIMENSION = 1400;
const DEFAULT_MIN_DIMENSION = 640;
const DEFAULT_MIN_QUALITY = 0.52;
const QUALITY_STEP = 0.08;
const DIMENSION_STEP = 0.86;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function extensionForMime(type: string) {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return "jpg";
}

function sanitizeBaseName(name: string, fallback: string) {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const sanitized = withoutExt.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || fallback;
}

function loadImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  return {
    imageUrl,
    promise: new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      image.src = imageUrl;
    }),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: OutputImageType, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("IMAGE_COMPRESSION_FAILED"));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function encodeCanvas(canvas: HTMLCanvasElement, type: OutputImageType, quality: number) {
  let blob: Blob;

  try {
    blob = await canvasToBlob(canvas, type, quality);
  } catch (error) {
    if (type === "image/webp") {
      return canvasToBlob(canvas, "image/jpeg", quality);
    }

    throw error;
  }

  if (type === "image/webp" && blob.type !== "image/webp") {
    return canvasToBlob(canvas, "image/jpeg", quality);
  }

  return blob;
}

function drawToCanvas(image: HTMLImageElement, maxDimension: number) {
  const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = Math.min(1, maxDimension / Math.max(1, longestSide));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new Error("CANVAS_NOT_AVAILABLE");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

export function formatImageBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export async function compressImageFile(file: File, options: ImageCompressionOptions = {}) {
  const {
    fileNamePrefix = "image",
    initialQuality = DEFAULT_INITIAL_QUALITY,
    maxDimension = DEFAULT_MAX_DIMENSION,
    minDimension = DEFAULT_MIN_DIMENSION,
    minQuality = DEFAULT_MIN_QUALITY,
    outputType = "image/webp",
    targetMaxBytes,
  } = options;

  if (!file.type.startsWith("image/")) {
    throw new Error("IMAGE_TYPE_INVALID");
  }

  const { imageUrl, promise } = loadImage(file);

  try {
    const image = await promise;
    let currentMaxDimension = Math.max(minDimension, maxDimension);
    let bestBlob: Blob | null = null;

    while (currentMaxDimension >= minDimension) {
      const canvas = drawToCanvas(image, currentMaxDimension);
      const startQuality = clamp(initialQuality, minQuality, 0.95);
      const stopQuality = clamp(minQuality, 0.2, startQuality);

      for (let quality = startQuality; quality >= stopQuality; quality -= QUALITY_STEP) {
        const blob = await encodeCanvas(canvas, outputType, Number(quality.toFixed(2)));
        bestBlob = blob;

        if (!targetMaxBytes || blob.size <= targetMaxBytes) {
          currentMaxDimension = 0;
          break;
        }
      }

      if (!targetMaxBytes || currentMaxDimension === 0 || currentMaxDimension === minDimension) {
        break;
      }

      currentMaxDimension = Math.max(minDimension, Math.floor(currentMaxDimension * DIMENSION_STEP));
    }

    if (!bestBlob) {
      throw new Error("IMAGE_COMPRESSION_FAILED");
    }

    const type = bestBlob.type || outputType;
    const extension = extensionForMime(type);
    const baseName = sanitizeBaseName(file.name, fileNamePrefix);

    return new File([bestBlob], `${baseName}.${extension}`, {
      lastModified: Date.now(),
      type,
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
