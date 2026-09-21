/**
 * Client-side photo downscaling. Phone photos are routinely over the 5 MB
 * server backstop on `/api/me/SaveAppPicture`, so the picker shrinks them
 * before upload instead of letting the server answer 413.
 */

/** Mirrors the server backstop in `src/app/api/me/[...path]/route.ts`. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Long-side cap in pixels; plenty for an avatar, far under the byte limit. */
export const MAX_PHOTO_DIMENSION = 1600;

const JPEG_QUALITY = 0.85;

/** Scales `width`×`height` down to fit `max` on the long side; never upscales. */
export function fitWithin(width: number, height: number, max: number) {
  const longSide = Math.max(width, height);
  if (longSide <= max) return { width, height };
  const scale = max / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Returns a JPEG no larger than `MAX_PHOTO_DIMENSION` on the long side.
 * Throws when the image cannot be decoded or still exceeds `MAX_PHOTO_BYTES`.
 */
export async function resizePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_PHOTO_DIMENSION);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("Could not encode the image.");
    if (blob.size > MAX_PHOTO_BYTES) throw new PhotoTooLargeError();

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super("Photo is still larger than the upload limit after resizing.");
    this.name = "PhotoTooLargeError";
  }
}
