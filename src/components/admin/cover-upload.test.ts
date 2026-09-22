import { describe, expect, it, vi } from "vitest";

import { COVER_TOO_LARGE, COVER_UPLOAD_BYTES, prepareCover } from "./cover-upload";

const fileOf = (bytes: number, type = "image/jpeg") =>
  new File([new Uint8Array(bytes)], "cover.jpg", { type });

describe("prepareCover", () => {
  it("sends a small cover as picked, without re-encoding it", async () => {
    const file = fileOf(COVER_UPLOAD_BYTES);
    const resize = vi.fn();
    await expect(prepareCover(file, resize)).resolves.toEqual({ file });
    expect(resize).not.toHaveBeenCalled();
  });

  it("downscales a phone photo that would overflow the 1MB action body", async () => {
    const small = fileOf(200 * 1024);
    const result = await prepareCover(fileOf(4 * 1024 * 1024), async () => small);
    expect(result).toEqual({ file: small });
  });

  it("refuses rather than posting something the server will reject", async () => {
    const still = fileOf(COVER_UPLOAD_BYTES + 1);
    await expect(prepareCover(fileOf(5_000_000), async () => still)).resolves.toEqual({
      error: COVER_TOO_LARGE,
    });
  });

  it("reports an undecodable image instead of throwing", async () => {
    const result = await prepareCover(fileOf(5_000_000), async () => {
      throw new Error("decode failed");
    });
    expect(result).toEqual({ error: COVER_TOO_LARGE });
  });
});
