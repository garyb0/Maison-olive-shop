import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DELIVERY_PROOFS_DIR = path.join(process.cwd(), "storage", "delivery-proofs");

const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getDeliveryProofExtension(mimeType: string) {
  return extensionByMime[mimeType] ?? null;
}

export function buildDeliveryProofFileName(input: {
  runId: string;
  stopId: string;
  mimeType: string;
}) {
  const extension = getDeliveryProofExtension(input.mimeType);
  if (!extension) {
    throw new Error("DELIVERY_PROOF_TYPE_INVALID");
  }
  return `${input.runId}-${input.stopId}-${randomUUID()}.${extension}`;
}

export async function saveDeliveryProofFile(input: {
  fileName: string;
  buffer: Buffer;
}) {
  await fs.mkdir(DELIVERY_PROOFS_DIR, { recursive: true });
  const fullPath = path.join(DELIVERY_PROOFS_DIR, input.fileName);
  await fs.writeFile(fullPath, input.buffer);
  return input.fileName;
}

export async function readDeliveryProofFile(fileName: string) {
  const fullPath = path.resolve(DELIVERY_PROOFS_DIR, fileName);
  const root = path.resolve(DELIVERY_PROOFS_DIR);

  if (!fullPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("DELIVERY_PROOF_NOT_FOUND");
  }

  return fs.readFile(fullPath);
}
