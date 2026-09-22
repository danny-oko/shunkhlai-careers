"use client";

import * as React from "react";
import { FileText, ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { profile as profileApi, toApiError } from "@/lib/api";
import { pictureSrc } from "@/lib/api/profile";
import { PhotoTooLargeError, resizePhoto } from "@/lib/resize-image";
import { describeCvFileError } from "@/lib/apply-schema";

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

export function CvManager() {
  const { profile, refresh } = useSession();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const fileError = describeCvFileError(file);
    if (fileError) {
      toast.error(fileError);
      return;
    }

    setIsBusy(true);
    try {
      await profileApi.uploadCv(file);
      toast.success("CV хавсаргалаа");
      await refresh();
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setIsBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("CV-г устгах уу?")) return;
    setIsBusy(true);
    try {
      await profileApi.deleteCv();
      toast.success("CV устгагдлаа");
      await refresh();
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <FileText className="text-muted-foreground size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">CV</p>
          <p className="text-muted-foreground truncate text-sm">
            {profile?.filename || "Хавсаргаагүй байна. PDF, DOC эсвэл DOCX, 5MB хүртэл."}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className="h-9 rounded-full px-4"
        >
          {isBusy ? <Loader2 className="animate-spin" /> : null}
          {profile?.filename ? "Солих" : "Хавсаргах"}
        </Button>
        {profile?.filename ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="CV устгах"
            disabled={isBusy}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        hidden
        onChange={onPick}
      />
    </div>
  );
}
