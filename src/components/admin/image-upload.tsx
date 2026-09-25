"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IMAGE_TYPES } from "@/lib/news/shared/limits";
import { cn } from "@/lib/utils";

/**
 * "Upload a picture", for any admin form that stores an image as a URL.
 *
 * It posts the file to `/admin/upload`, which signs the upload server-side and
 * answers with the Cloudinary address — so the only thing that reaches this
 * component, and therefore the browser, is a URL. No cloud name, no api key,
 * no upload preset, nothing that could be replayed from a page's source.
 *
 * It owns no value of its own: it hands the URL back through `onUploaded` and
 * the form decides what to do with it. That is what lets the same button sit
 * beside the newsroom's existing "image link" field, where it fills the field
 * the editor could also have pasted into, and beside the hero's slide rows,
 * where it replaces a slide's `src`.
 *
 * Sized as a secondary control — 38px tall, 13px type — like the URL field it
 * stands next to. It is the quicker of two ways to do the same thing, not the
 * form's main action.
 */

export const UPLOAD_CONTROL = "h-[38px] text-[0.8125rem]";

const GENERIC_ERROR = "Зургийг байршуулж чадсангүй. Дахин оролдоно уу.";

/** What comes back from `/admin/upload`, without trusting that it did. */
function readResult(payload: unknown): { url: string } | { error: string } {
  if (typeof payload === "object" && payload !== null) {
    const { url, error } = payload as { url?: unknown; error?: unknown };
    if (typeof url === "string" && url.startsWith("https://")) return { url };
    if (typeof error === "string" && error) return { error };
  }
  return { error: GENERIC_ERROR };
}

export function ImageUpload({
  folder,
  label = "Зураг байршуулах",
  onUploaded,
  className,
}: {
  /** Which folder under `shunhlai/` the picture is filed in. */
  folder: "hero" | "culture" | "news";
  label?: string;
  onUploaded: (url: string) => void;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);

    const body = new FormData();
    body.set("file", file);
    body.set("folder", folder);

    try {
      const response = await fetch("/admin/upload", { method: "POST", body });
      // The proxy answers an expired session with a redirect to the login
      // page, which `fetch` follows — so an HTML body here means "signed out",
      // not "broken". Say the useful thing rather than failing to parse it.
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("application/json")) {
        setError("Нэвтрэх хугацаа дууссан байж магадгүй. Хуудсыг дахин ачаална уу.");
        return;
      }

      const result = readResult(await response.json());
      if ("error" in result) setError(result.error);
      else onUploaded(result.url);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
      // Cleared so picking the same file twice fires `change` again — after a
      // failure, retrying with the same picture is the obvious thing to try.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button asChild variant="outline" className={cn(UPLOAD_CONTROL, "w-fit")} disabled={busy}>
        <label>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
          {busy ? "Байршуулж байна…" : label}
          <input
            ref={inputRef}
            type="file"
            // No `name`: this input is never submitted with the form. The file
            // goes up on its own and only its URL joins the form's values.
            accept={IMAGE_TYPES.join(",")}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
            className="sr-only"
          />
        </label>
      </Button>

      {error && (
        <p role="alert" className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
