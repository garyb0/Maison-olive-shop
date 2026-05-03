const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const hasBytesAt = (buffer: Buffer, offset: number, bytes: readonly number[]) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

export function bufferMatchesImageMime(buffer: Buffer, mimeType: string) {
  if (buffer.length < 12) return false;

  if (mimeType === "image/png") {
    return hasBytesAt(buffer, 0, PNG_SIGNATURE);
  }

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }

  if (mimeType === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
}
