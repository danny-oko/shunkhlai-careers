import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { UPLOAD_TOO_LARGE_MESSAGE, toApiError } from "./errors";

/** An axios failure with this status and body, as the upload call sees it. */
function failed(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  });
}

describe("toApiError on a 413", () => {
  it("says the file is too large when the host refused it with a bare page", () => {
    // Vercel's answer to a body over 4.5 MB, byte for byte in shape.
    const vercel = "Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE\n\nhkg1::abc\n";
    expect(toApiError(failed(413, vercel))).toEqual({
      message: UPLOAD_TOO_LARGE_MESSAGE,
      status: 413,
      fieldErrors: undefined,
    });
  });

  it("keeps the app's own message when /api/me sent one", () => {
    const own = { rettype: 1, retmsg: "Файл 4 MB-аас том байна. Жижиг файл сонгоно уу." };
    expect(toApiError(failed(413, own)).message).toBe(own.retmsg);
  });

  it("still says try again for any other failure without a message", () => {
    expect(toApiError(failed(502, "Bad Gateway")).message).toBe("Алдаа гарлаа. Дахин оролдоно уу.");
  });
});
