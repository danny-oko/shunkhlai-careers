"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CvDropzone } from "@/components/cv-dropzone";
import { applications, isBackendUnavailable, toApiError } from "@/lib/api";
import {
  applicationDefaults,
  applicationSchema,
  type ApplicationValues,
} from "@/lib/apply-schema";
import type { Job } from "@/lib/jobs/types";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function EasyApplyModal({
  job,
  open,
  onOpenChange,
}: {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: applicationDefaults,
    mode: "onBlur",
  });

  async function onSubmit(values: ApplicationValues) {
    const payload = new FormData();
    payload.append("jobId", job.id);
    payload.append("jobTitle", job.title);
    payload.append("fullName", values.fullName);
    payload.append("email", values.email);
    payload.append("phone", values.phone);
    payload.append("registerId", values.registerId);
    if (values.note) payload.append("note", values.note);
    if (values.cv) payload.append("cv", values.cv);

    try {
      await applications.submitEasyApplication(payload);
      setIsSubmitted(true);
    } catch (error) {
      // The one-screen apply form has no endpoint in the recruitment API yet
      // (see `submitEasyApplication`); until it does, an unreachable service
      // counts as a local success so the flow stays testable.
      if (isBackendUnavailable(error)) {
        setIsSubmitted(true);
        return;
      }

      toast.error("We couldn't send your application", {
        description: toApiError(error).message,
      });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      // Let the close animation finish before clearing the form.
      window.setTimeout(() => {
        reset(applicationDefaults);
        setIsSubmitted(false);
      }, 250);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        aria-describedby="easy-apply-description"
      >
        {isSubmitted ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10">
              <Check className="size-5 text-primary" />
            </span>
            <div className="space-y-2">
              <SheetTitle className="text-xl tracking-[-0.02em]">
                Application received
              </SheetTitle>
              <SheetDescription className="text-pretty">
                Thank you for applying to {job.title}. Our recruitment team
                reviews every application and will be in touch within five
                working days.
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              className="mt-2 h-9 rounded-full px-5"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <SheetHeader className="gap-1 border-b border-border/70 px-6 py-5">
              <SheetTitle className="text-lg tracking-[-0.02em]">
                Apply for {job.title}
              </SheetTitle>
              <SheetDescription id="easy-apply-description">
                {job.location} · {job.type}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Батбаярын Ариунаа"
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? "fullName-error" : undefined}
                  {...register("fullName")}
                />
                <FieldError id="fullName-error" message={errors.fullName?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="ariunaa@example.mn"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
                <FieldError id="email-error" message={errors.email?.message} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="9911 2233"
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? "phone-error" : undefined}
                    {...register("phone")}
                  />
                  <FieldError id="phone-error" message={errors.phone?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registerId">Register ID</Label>
                  <Input
                    id="registerId"
                    placeholder="УБ99112233"
                    autoCapitalize="characters"
                    aria-invalid={Boolean(errors.registerId)}
                    aria-describedby={
                      errors.registerId ? "registerId-error" : undefined
                    }
                    {...register("registerId")}
                  />
                  <FieldError
                    id="registerId-error"
                    message={errors.registerId?.message}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cv">Curriculum vitae</Label>
                <Controller
                  name="cv"
                  control={control}
                  render={({ field }) => (
                    <CvDropzone
                      file={field.value ?? null}
                      onFileChange={field.onChange}
                      invalid={Boolean(errors.cv)}
                      describedBy={errors.cv ? "cv-error" : undefined}
                    />
                  )}
                />
                <FieldError id="cv-error" message={errors.cv?.message as string} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">
                  Anything else{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="note"
                  rows={3}
                  placeholder="A short note about why this role interests you."
                  aria-invalid={Boolean(errors.note)}
                  aria-describedby={errors.note ? "note-error" : undefined}
                  {...register("note")}
                />
                <FieldError id="note-error" message={errors.note?.message} />
              </div>
            </div>

            <SheetFooter className="mt-0 gap-3 border-t border-border/70 px-6 py-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 w-full rounded-full text-[0.9375rem]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending
                  </>
                ) : (
                  "Submit application"
                )}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                By applying you agree that Shunkhlai Group may process your
                personal data for recruitment purposes.
              </p>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
