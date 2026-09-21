"use client";

import * as React from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { profile as profileApi, toApiError } from "@/lib/api";
import { pictureSrc } from "@/lib/api/profile";

/** Profile photo — the one thing `SaveHrApplicant` does not carry. (Clerk owns the password.) */

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
      await profileApi.uploadPhoto(file);
      toast.success("Профайл зураг шинэчлэгдлээ");
      await refresh();
    } catch (error) {
      toast.error(toApiError(error).message);
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
        <p className="text-muted-foreground mt-1 text-sm">
          Сервер талд автоматаар багасгаж хадгална.
        </p>
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
