import { bufferMatchesImageMime } from "@/lib/image-validation";

describe("image validation", () => {
  it("valide les signatures binaires attendues", () => {
    expect(bufferMatchesImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), "image/png")).toBe(true);
    expect(bufferMatchesImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), "image/jpeg")).toBe(true);
    expect(bufferMatchesImageMime(Buffer.from("GIF89a000000", "ascii"), "image/gif")).toBe(true);
    expect(bufferMatchesImageMime(Buffer.from("RIFF0000WEBP", "ascii"), "image/webp")).toBe(true);
  });

  it("rejette un contenu texte deguise en image", () => {
    expect(bufferMatchesImageMime(Buffer.from("<script>alert(1)</script>"), "image/png")).toBe(false);
  });
});
