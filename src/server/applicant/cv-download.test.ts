import { describe, expect, it } from "vitest";

import { contentDisposition, cvResponse } from "./cv-download";

describe("contentDisposition", () => {
  it("keeps an ASCII name as is", () => {
    expect(contentDisposition("cv.pdf")).toBe(`attachment; filename="cv.pdf"; filename*=UTF-8''cv.pdf`);
  });

  it("gives a Cyrillic name an ASCII fallback and the exact UTF-8 name", () => {
    const header = contentDisposition("Бат.docx");
    // eslint-disable-next-line no-secrets/no-secrets -- a percent-encoded name, not a secret
    expect(header).toBe(`attachment; filename="___.docx"; filename*=UTF-8''%D0%91%D0%B0%D1%82.docx`);
  });

  it("cannot break out of the header (quotes, backslash, line breaks, RFC 5987 specials)", () => {
    const header = contentDisposition(`a"b\\c\r\nX-Evil: 1 (1)'*.pdf`);
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain(`filename="a_b_c__X-Evil: 1 (1)'*.pdf"`);
    // eslint-disable-next-line no-secrets/no-secrets -- a percent-encoded name, not a secret
    expect(header).toContain(`filename*=UTF-8''a%22b%5Cc%0D%0AX-Evil%3A%201%20%281%29%27%2A.pdf`);
    expect(() => new Headers({ "Content-Disposition": header })).not.toThrow();
  });
});

describe("cvResponse", () => {
  it("serves the decoded bytes with the MIME type from the name, uncached", async () => {
    const res = cvResponse({ filename: "cv.doc", data: Buffer.from([1, 2, 3]).toString("base64") });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/msword");
    expect(res.headers.get("content-length")).toBe("3");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
  });
});
