"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { auth, toApiError } from "@/lib/api";

/**
 * Sign-up and sign-in share a screen because they share an endpoint:
 * `SaveHrAppUser` creates the account when the register number is new and
 * signs in when it is not. The phone number is the initial password, which the
 * copy has to say out loud or the first sign-in is a guessing game.
 */

const REGNO_PATTERN = /^[А-ЯӨҮЁ]{2}\d{8}$/i;

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();

  const [values, setValues] = React.useState({
    lastname: "",
    firstname: "",
    regno: "",
    email: "",
    mobilephone: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const isSignUp = mode === "signup";
  const next = params.get("next") || "/account";

  function set(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const regno = values.regno.trim().toUpperCase();
    if (!REGNO_PATTERN.test(regno)) {
      setError("Регистрийн дугаараа шалгана уу — жишээ нь УБ99010101.");
      return;
    }
    if (!values.mobilephone.trim()) {
      setError(isSignUp ? "Утасны дугаараа оруулна уу." : "Нууц үгээ оруулна уу.");
      return;
    }
    if (isSignUp && (!values.lastname.trim() || !values.firstname.trim())) {
      setError("Овог болон нэрээ оруулна уу.");
      return;
    }

    setIsBusy(true);
    try {
      if (isSignUp) {
        await auth.signUp({
          lastname: values.lastname.trim(),
          firstname: values.firstname.trim(),
          regno,
          email: values.email.trim(),
          mobilephone: values.mobilephone.trim(),
        });
      } else {
        await auth.signIn({ regno, mobilephone: values.mobilephone.trim() });
      }

      await refresh();
      router.push(next);
      router.refresh();
    } catch (submitError) {
      setError(toApiError(submitError).message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {isSignUp ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Овог" htmlFor="lastname" required>
            <Input
              id="lastname"
              autoComplete="family-name"
              value={values.lastname}
              onChange={(event) => set("lastname", event.target.value)}
            />
          </Field>
          <Field label="Нэр" htmlFor="firstname" required>
            <Input
              id="firstname"
              autoComplete="given-name"
              value={values.firstname}
              onChange={(event) => set("firstname", event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Регистрийн дугаар" htmlFor="regno" required hint="Жишээ: УБ99010101">
        <Input
          id="regno"
          autoCapitalize="characters"
          autoComplete="username"
          placeholder="УБ99010101"
          value={values.regno}
          onChange={(event) => set("regno", event.target.value)}
        />
      </Field>

      {isSignUp ? (
        <Field label="И-мэйл" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
          />
        </Field>
      ) : null}

      <Field
        label={isSignUp ? "Утасны дугаар" : "Нууц үг"}
        htmlFor="mobilephone"
        required
        hint={
          isSignUp
            ? "Энэ дугаар таны анхны нууц үг болно — дараа нь солих боломжтой."
            : "Анхны нууц үг нь бүртгүүлэхэд ашигласан утасны дугаар."
        }
      >
        <Input
          id="mobilephone"
          type={isSignUp ? "tel" : "password"}
          autoComplete={isSignUp ? "tel" : "current-password"}
          value={values.mobilephone}
          onChange={(event) => set("mobilephone", event.target.value)}
        />
      </Field>

      <FormMessage message={error} />

      <Button type="submit" disabled={isBusy} className="h-10 w-full rounded-full">
        {isBusy ? <Loader2 className="animate-spin" /> : null}
        {isSignUp ? "Бүртгүүлэх" : "Нэвтрэх"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? (
          <>
            Бүртгэлтэй юу?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4">
              Нэвтрэх
            </Link>
          </>
        ) : (
          <>
            Шинэ хэрэглэгч үү?{" "}
            <Link href="/register" className="text-foreground underline underline-offset-4">
              Бүртгүүлэх
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
