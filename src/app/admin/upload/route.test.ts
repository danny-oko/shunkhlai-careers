import { beforeEach, describe, expect, it, vi } from "vitest";

import { UPLOAD_SIZE_ERROR, UPLOAD_TYPE_ERROR } from "@/server/media/cloudinary";
import { LIMITS } from "@/lib/news/shared/limits";

/**
 * The upload route is the one endpoint in this feature that anyone can post
 * to, so its two refusals are the ones worth a test: a caller who is not an
 * admin, and a file the app will not take.
 *
 * `next/server` is stubbed down to the one function used — the route wants a
 * JSON response, and pulling the real module into a unit test buys nothing.
 * Cloudinary is never reached: `uploadImage` is mocked, and the assertions
 * below are that it was *not* called.
 */

const guard = vi.hoisted(() => ({
  isAdminRequest: vi.fn(async () => true),
  requireAdmin: vi.fn(async () => undefined),
}));

const media = vi.hoisted(() => ({ uploadImage: vi.fn() }));

vi.mock("@/server/admin/guard", () => guard);

vi.mock("@/server/media/cloudinary", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/media/cloudinary")>(
      "@/server/media/cloudinary",
    );
  return { ...actual, uploadImage: media.uploadImage };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const { POST } = await import("./route");

/** A request carrying one file, as the picker in the admin forms sends it. */
function request(file: File | null, folder = "news"): Request {
  const body = new FormData();
  if (file) body.set("file", file);
  body.set("folder", folder);
  return new Request("http://localhost/admin/upload", { method: "POST", body });
}

/**
 * Real `File`s throughout, and really that many bytes.
 *
 * The route reads its file back out of a multipart body, so a `File` with a
 * `size` property redefined on it does not survive the trip — the parse builds
 * a fresh one from the bytes that were actually sent. An oversized file has to
 * be oversized.
 */
function file(type: string, bytes = 4): File {
  return new File([new Uint8Array(bytes)], "a.png", { type });
}

const realFile = () => file("image/png");

beforeEach(() => {
  guard.isAdminRequest.mockReset().mockResolvedValue(true);
  media.uploadImage.mockReset().mockResolvedValue({ url: "https://res.cloudinary.com/x/a.png" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the admin guard", () => {
  it("refuses a caller who is not signed in, and uploads nothing", async () => {
    guard.isAdminRequest.mockResolvedValue(false);

    const response = await POST(request(realFile()));

    expect(response.status).toBe(401);
    expect(media.uploadImage).not.toHaveBeenCalled();
  });

  it("answers 401 rather than redirecting — the caller is a `fetch`", async () => {
    guard.isAdminRequest.mockResolvedValue(false);
    const response = await POST(request(realFile()));
    expect(await response.json()).toHaveProperty("error");
  });

  it("lets a signed-in admin through", async () => {
    const response = await POST(request(realFile()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://res.cloudinary.com/x/a.png" });
  });
});

describe("what may be uploaded", () => {
  it("refuses a request with no file", async () => {
    const response = await POST(request(null));
    expect(response.status).toBe(400);
    expect(media.uploadImage).not.toHaveBeenCalled();
  });

  it("refuses the wrong type, from the real validator", async () => {
    // The route hands the file to `uploadImage`, which refuses it before it
    // builds a request — asserted here through the route's own answer.
    const actual = await vi.importActual<typeof import("@/server/media/cloudinary")>(
      "@/server/media/cloudinary",
    );
    media.uploadImage.mockImplementation(actual.uploadImage);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("Cloudinary must not be reached");
      }),
    );

    const response = await POST(request(file("image/svg+xml")));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: UPLOAD_TYPE_ERROR });
    vi.unstubAllGlobals();
  });

  it("refuses a file over the size limit", async () => {
    const actual = await vi.importActual<typeof import("@/server/media/cloudinary")>(
      "@/server/media/cloudinary",
    );
    media.uploadImage.mockImplementation(actual.uploadImage);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("Cloudinary must not be reached");
      }),
    );

    const response = await POST(request(file("image/png", LIMITS.imageBytes + 1)));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: UPLOAD_SIZE_ERROR });
    vi.unstubAllGlobals();
  });
});

describe("the folder", () => {
  it("is taken from the request only when it is one of ours", async () => {
    await POST(request(realFile(), "hero"));
    expect(media.uploadImage).toHaveBeenCalledWith(expect.anything(), "hero");
  });

  it("falls back rather than filing a signed upload anywhere in the account", async () => {
    await POST(request(realFile(), "../../etc"));
    expect(media.uploadImage).toHaveBeenCalledWith(expect.anything(), "news");
  });
});
