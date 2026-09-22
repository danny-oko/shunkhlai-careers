import { resizePhoto } from "@/lib/resize-image";

/**
 * The most a cover may weigh on the way up.
 *
 * The save is a server action, and Next refuses a server-action body over
 * 1MB (`serverActions.bodySizeLimit`) before the action runs — the editor
 * gets an unhandled error and loses the page. The body JSON rides in the same
 * request, so the cover gets a little over half of that.
 */
export const COVER_UPLOAD_BYTES = 600 * 1024;

export const COVER_TOO_LARGE = "Зураг хэт том байна. Илүү жижиг зураг сонгоно уу.";

export type PreparedCover = { file: File } | { error: string };

/**
 * A picked cover, made small enough to send.
 *
 * Anything under the budget goes as picked. Anything over is downscaled to a
 * JPEG; if it cannot be decoded, or is somehow still too heavy, the editor is
 * told here rather than by a failed save.
 */
export async function prepareCover(
  file: File,
  resize: (file: File) => Promise<File> = resizePhoto,
): Promise<PreparedCover> {
  if (file.size <= COVER_UPLOAD_BYTES) return { file };

  try {
    const smaller = await resize(file);
    return smaller.size <= COVER_UPLOAD_BYTES ? { file: smaller } : { error: COVER_TOO_LARGE };
  } catch {
    return { error: COVER_TOO_LARGE };
  }
}

/**
 * Puts `file` into a file input, so a plain form post carries it.
 *
 * Used twice: to swap the picked file for its downscaled copy, and to put the
 * cover back after React resets the form at the end of a rejected save — a
 * file input is uncontrolled, so the reset empties it while the preview still
 * shows the picture.
 */
export function setInputFile(input: HTMLInputElement, file: File): boolean {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    return true;
  } catch {
    return false;
  }
}
