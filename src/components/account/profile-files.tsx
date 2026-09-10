"use client";

import * as React from "react";
import { FileText, ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { account, profile as profileApi, toApiError } from "@/lib/api";
import { pictureSrc } from "@/lib/api/profile";
import { describeCvFileError } from "@/lib/apply-schema";

/** Profile photo, CV and password — the three things `SaveHrApplicant` does not carry. */

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

export function PasswordForm() {
  const [oldpassword, setOld] = React.useState("");
  const [newpassword, setNew] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newpassword.length < 6) {
      setError("Шинэ нууц үг дор хаяж 6 тэмдэгттэй байна.");
      return;
    }
    if (newpassword !== confirm) {
      setError("Шинэ нууц үг хоёр хоорондоо таарахгүй байна.");
      return;
    }

    setIsBusy(true);
    try {
      await account.changePassword(oldpassword, newpassword);
      toast.success("Нууц үг солигдлоо");
      setOld("");
      setNew("");
      setConfirm("");
    } catch (submitError) {
      setError(toApiError(submitError).message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Одоогийн нууц үг" htmlFor="oldpassword" required>
          <Input
            id="oldpassword"
            type="password"
            autoComplete="current-password"
            value={oldpassword}
            onChange={(event) => setOld(event.target.value)}
          />
        </Field>
        <Field label="Шинэ нууц үг" htmlFor="newpassword" required>
          <Input
            id="newpassword"
            type="password"
            autoComplete="new-password"
            value={newpassword}
            onChange={(event) => setNew(event.target.value)}
          />
        </Field>
        <Field label="Шинэ нууц үг давтах" htmlFor="confirm" required>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
      </div>

      <FormMessage message={error} />

      <Button type="submit" variant="outline" disabled={isBusy} className="h-9 rounded-full px-5">
        {isBusy ? <Loader2 className="animate-spin" /> : null}
        Нууц үг солих
      </Button>
    </form>
  );
}
