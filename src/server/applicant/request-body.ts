/** Request-body readers shared by the mock applicant route and `/api/me`. */

export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** The first non-empty file of a multipart body, base64-encoded, with its reported MIME type. */
export async function readUpload(
  request: Request,
): Promise<{ name: string; type: string; data: string } | null> {
  try {
    const form = await request.formData();
    for (const value of form.values()) {
      if (value instanceof File && value.size > 0) {
        const buffer = Buffer.from(await value.arrayBuffer());
        return { name: value.name, type: value.type, data: buffer.toString("base64") };
      }
    }
  } catch {
    return null;
  }
  return null;
}
