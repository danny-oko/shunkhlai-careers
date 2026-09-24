import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MEDIA_FOLDERS,
  UPLOAD_SIZE_ERROR,
  UPLOAD_TYPE_ERROR,
  cloudinaryConfig,
  signUpload,
  signatureBase,
  uploadEndpoint,
  uploadFields,
  uploadImage,
  uploadParams,
  uploadProblem,
} from "./cloudinary";
import { LIMITS } from "@/lib/news/shared/limits";

/**
 * The signing is the part of this module that has to be exactly right, and it
 * is pure — so it is tested directly rather than through an upload.
 *
 * Two properties matter. The first is the scheme itself: Cloudinary rebuilds
 * the same string from the parameters it receives and hashes it with its own
 * copy of the secret, so the parameters have to be sorted by name and joined
 * the one way, or every upload is refused. The second is that the secret only
 * ever leaves this module folded into a hash — never as a field, never in a
 * returned value, never in an error.
 *
 * Nothing here reaches Cloudinary. `fetch` is stubbed, and the two cases that
 * would reach it are the two that must not: a file of the wrong type and a
 * file over the limit are refused before a request is built.
 */

const SECRET = "SECRET";

describe("signatureBase — the exact string that gets hashed", () => {
  it("sorts the parameters by name, whatever order they arrive in", () => {
    expect(signatureBase({ timestamp: 1700000000, folder: "shunhlai/hero" })).toBe(
      "folder=shunhlai/hero&timestamp=1700000000",
    );
    // The same parameters the other way round must produce the same string —
    // this is the property Cloudinary's own re-derivation depends on.
    expect(signatureBase({ folder: "shunhlai/hero", timestamp: 1700000000 })).toBe(
      signatureBase({ timestamp: 1700000000, folder: "shunhlai/hero" }),
    );
  });

  it("sorts every key, not just the two", () => {
    expect(signatureBase({ z: 1, a: 2, m: 3 })).toBe("a=2&m=3&z=1");
  });

  it("drops empty values rather than sending `k=`", () => {
    expect(signatureBase({ folder: "", timestamp: 7 })).toBe("timestamp=7");
  });

  it("never contains the secret — it is not one of the parameters", () => {
    expect(signatureBase(uploadParams("hero", 1700000000))).not.toContain(SECRET);
  });
});

describe("signUpload", () => {
  it("is SHA-1 of the sorted parameters with the secret appended", () => {
    // Computed outside this codebase, with the base string below followed
    // immediately by the secret:
    //   printf '<base><secret>' | shasum -a 1
    const base = signatureBase({ timestamp: 1700000000, folder: "shunhlai/hero" });
    expect(base).toBe("folder=shunhlai/hero&timestamp=1700000000");
    expect(signUpload({ timestamp: 1700000000, folder: "shunhlai/hero" }, SECRET)).toBe(
      "bcf69817746b3da8016cc20739764e89543dd9fd",
    );
  });

  it("changes with the secret, so a wrong secret cannot sign", () => {
    const params = uploadParams("news", 1700000000);
    expect(signUpload(params, SECRET)).not.toBe(signUpload(params, "OTHER"));
  });

  it("does not leak the secret into the hex it returns", () => {
    const signature = signUpload(uploadParams("news", 1700000000), SECRET);
    expect(signature).toMatch(/^[0-9a-f]{40}$/u);
    expect(signature).not.toContain(SECRET);
  });
});

describe("uploadFields — what is actually sent", () => {
  const params = uploadParams("hero", 1700000000);
  const fields = uploadFields(params, "public-api-key", signUpload(params, SECRET));

  it("carries the api key and the signature, and nothing else new", () => {
    expect(fields.api_key).toBe("public-api-key");
    expect(fields.signature).toMatch(/^[0-9a-f]{40}$/u);
    expect(fields.folder).toBe(MEDIA_FOLDERS.hero);
  });

  it("never carries the secret, under any name", () => {
    expect(Object.keys(fields)).not.toContain("api_secret");
    for (const value of Object.values(fields)) expect(value).not.toContain(SECRET);
    expect(JSON.stringify(fields)).not.toContain(SECRET);
  });
});

describe("uploadParams / endpoints", () => {
  it("files everything under the one folder", () => {
    expect(MEDIA_FOLDERS.hero).toBe("shunhlai/hero");
    expect(MEDIA_FOLDERS.news).toBe("shunhlai/news");
    expect(uploadParams("news", 1).folder).toBe("shunhlai/news");
  });

  it("signs `allowed_formats` too, so the server enforces the same list", () => {
    expect(uploadParams("news", 1).allowed_formats).toBe("jpg,jpeg,png,webp,avif");
  });

  it("posts to the account's own image endpoint", () => {
    expect(uploadEndpoint("shunkhlai")).toBe(
      "https://api.cloudinary.com/v1_1/shunkhlai/image/upload",
    );
  });
});

describe("uploadProblem — the repo's existing image limits", () => {
  it("accepts the four raster types the newsroom already accepts", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(uploadProblem({ type, size: 1024 })).toBeNull();
    }
  });

  it("refuses anything else, SVG included", () => {
    expect(uploadProblem({ type: "image/svg+xml", size: 1024 })).toBe(UPLOAD_TYPE_ERROR);
    expect(uploadProblem({ type: "application/pdf", size: 1024 })).toBe(UPLOAD_TYPE_ERROR);
  });

  it("refuses a file over the limit", () => {
    expect(uploadProblem({ type: "image/png", size: LIMITS.imageBytes })).toBeNull();
    expect(uploadProblem({ type: "image/png", size: LIMITS.imageBytes + 1 })).toBe(
      UPLOAD_SIZE_ERROR,
    );
  });
});

describe("cloudinaryConfig", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("is null until all three variables are set", () => {
    delete process.env.CLOUDINARY_API_SECRET;
    process.env.CLOUDINARY_CLOUD_NAME = "shunkhlai";
    process.env.CLOUDINARY_API_KEY = "key";
    expect(cloudinaryConfig()).toBeNull();

    process.env.CLOUDINARY_API_SECRET = SECRET;
    expect(cloudinaryConfig()).toEqual({
      cloudName: "shunkhlai",
      apiKey: "key",
      apiSecret: SECRET,
    });
  });
});

describe("uploadImage — a refused file never becomes a request", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockReset();
    process.env.CLOUDINARY_CLOUD_NAME = "shunkhlai";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const file = (type: string, size: number) =>
    // Only the reported type and size are read before the refusal, so the
    // bytes need not be real — and an 8MB buffer in a unit test would not be.
    ({ type, size, name: "a.png" }) as unknown as File;

  it("refuses the wrong type without calling Cloudinary", async () => {
    await expect(uploadImage(file("image/svg+xml", 1024), "news")).resolves.toEqual({
      error: UPLOAD_TYPE_ERROR,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an oversized file without calling Cloudinary", async () => {
    await expect(
      uploadImage(file("image/png", LIMITS.imageBytes + 1), "news"),
    ).resolves.toEqual({ error: UPLOAD_SIZE_ERROR });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns only the secure_url when Cloudinary accepts it", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        secure_url: "https://res.cloudinary.com/shunkhlai/image/upload/v1/shunhlai/news/a.png",
        api_key: "key",
      }),
    });

    const result = await uploadImage(file("image/png", 2048), "news", 1700000000000);

    expect(result).toEqual({
      url: "https://res.cloudinary.com/shunkhlai/image/upload/v1/shunhlai/news/a.png",
    });
    expect(JSON.stringify(result)).not.toContain(SECRET);

    // And the request it built signed the parameters it sent.
    const [url, init] = fetchSpy.mock.calls[0] as [string, { body: FormData }];
    expect(url).toBe(uploadEndpoint("shunkhlai"));
    expect(init.body.get("signature")).toBe(
      signUpload(uploadParams("news", 1700000000), SECRET),
    );
    expect(init.body.get("api_secret")).toBeNull();
  });

  it("reports a refusal from Cloudinary as a message, not an exception", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Invalid Signature" } }),
    });

    const result = await uploadImage(file("image/png", 2048), "news");
    expect(result).toHaveProperty("error");
    // Cloudinary's own wording can quote the request back; it is logged, not
    // forwarded to the browser.
    expect(JSON.stringify(result)).not.toContain("Invalid Signature");
  });
});
