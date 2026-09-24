"use client";

import * as React from "react";
import { Download, FileText, ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { IdentityLock, useIdentityReady } from "@/components/account/identity-gate";
import { useSession } from "@/components/auth/session-provider";
import { CvDropzone } from "@/components/cv-dropzone";
import { Button } from "@/components/ui/button";
import { profile as profileApi, toApiError } from "@/lib/api";
import { pictureSrc } from "@/lib/api/profile";
import { PhotoTooLargeError, resizePhoto } from "@/lib/resize-image";
import { CV_LIMITS_TEXT, describeCvFileError } from "@/lib/apply-rules";

/** Profile photo and CV — the two things `SaveHrApplicant` does not carry. (Clerk owns the password.) */

export function PhotoUpload() {
  const { profile, refresh } = useSession();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const photo = profile ? pictureSrc(profile) : null;

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Зураг оруулна уу (JPG, PNG).");
      return;
    }

    setIsBusy(true);
    try {
      // Phone photos exceed the 5 MB server limit; shrink before uploading.
      await profileApi.uploadPhoto(await resizePhoto(file));
      toast.success("Профайл зураг шинэчлэгдлээ");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof PhotoTooLargeError
          ? "Зураг хэт том байна. Жижиг зураг сонгоно уу."
          : toApiError(error).message,
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <span className="bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full">
        {photo ? (
          // Base64 from the API — next/image has nothing to optimise here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Профайл зураг" className="size-full object-cover" />
        ) : (
          <ImageUp className="text-muted-foreground size-6" />
        )}
      </span>

      <div>
        <p className="font-medium">Профайл зураг</p>
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className="mt-3 h-9 rounded-full px-4"
        >
          {isBusy ? <Loader2 className="animate-spin" /> : null}
          {photo ? "Солих" : "Зураг сонгох"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPick}
        />
      </div>
    </div>
  );
}

/**
 * Upload / replace / delete / download of the one stored CV (`SaveAppCV`
 * re-uploading replaces it; `deleteAppCV`; the bytes from `/api/me/cv`).
 * Changes are off until the identity gate is passed — the server refuses them
 * too; downloading is a read and always allowed.
 */
export function useCv() {
  const { profile, refresh } = useSession();
  const { ready } = useIdentityReady();
  const [pending, setPending] = React.useState<File | null>(null);
  const [action, setAction] = React.useState<"upload" | "delete" | "download" | null>(null);
  const isBusy = action !== null;

  async function upload(file: File | null): Promise<boolean> {
    if (!file || isBusy) return false;
    const fileError = describeCvFileError(file);
    if (fileError) {
      toast.error(fileError);
      return false;
    }

    setPending(file);
    setAction("upload");
    try {
      await profileApi.uploadCv(file);
      toast.success("CV хавсаргалаа");
      await refresh();
      return true;
    } catch (error) {
      toast.error(toApiError(error).message);
      return false;
    } finally {
      setPending(null);
      setAction(null);
    }
  }

  async function remove() {
    if (!window.confirm("CV-г устгах уу?")) return;
    setAction("delete");
    try {
      await profileApi.deleteCv();
      toast.success("CV устгагдлаа");
      await refresh();
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setAction(null);
    }
  }

  async function download() {
    const filename = profile?.filename;
    if (!filename) return;
    setAction("download");
    try {
      saveBlob(await profileApi.downloadCv(), filename);
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setAction(null);
    }
  }

  return {
    filename: profile?.filename || null,
    pending,
    action,
    isBusy,
    /** Upload / replace / delete are off. */
    locked: isBusy || !ready,
    upload,
    remove,
    download,
  };
}

/** Hands a downloaded file to the browser under its stored name. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick: the click has started the download by then.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const cvStatus = (cv: ReturnType<typeof useCv>) =>
  cv.pending ? "Хуулж байна…" : cv.filename || `Хавсаргаагүй байна. ${CV_LIMITS_TEXT}.`;

export function CvManager() {
  const cv = useCv();
  const [isReplacing, setIsReplacing] = React.useState(false);
  const showDropzone = !cv.filename || isReplacing || cv.pending !== null;

  async function onFile(file: File | null) {
    if (await cv.upload(file)) setIsReplacing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {cv.pending ? (
            <Loader2 className="text-muted-foreground size-5 shrink-0 animate-spin" />
          ) : (
            <FileText className="text-muted-foreground size-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-medium">CV</p>
            <p className="text-muted-foreground truncate text-sm">{cvStatus(cv)}</p>
          </div>
        </div>

        {cv.filename ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={cv.isBusy}
              onClick={cv.download}
              className="h-9 rounded-full px-4"
            >
              {cv.action === "download" ? <Loader2 className="animate-spin" /> : <Download />}
              Татах
            </Button>
            <IdentityLock>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={cv.locked}
                  onClick={() => setIsReplacing((open) => !open)}
                  className="h-9 rounded-full px-4"
                >
                  {isReplacing ? "Болих" : "Солих"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="CV устгах"
                  disabled={cv.locked}
                  onClick={cv.remove}
                >
                  {cv.action === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              </div>
            </IdentityLock>
          </div>
        ) : null}
      </div>

      {showDropzone ? (
        <IdentityLock>
          <CvDropzone file={cv.pending} onFileChange={onFile} disabled={cv.locked} />
        </IdentityLock>
      ) : null}
    </div>
  );
}
