"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { saveSectionAction, type ContentActionState } from "@/app/admin/content/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  Field,
  RowAdd,
  RowRemove,
  SectionShell,
  useRows,
} from "@/components/admin/content/section-shell";
import { CONTENT_LIMITS } from "@/lib/content/schema";
import type { AboutStatsContent, FooterContent, HeroContent } from "@/lib/content/schema";
import { CONTENT_SECTIONS } from "@/lib/content/defaults";

/**
 * The three section forms of `/admin/content`.
 *
 * Each is a controlled form over its section's document: the rows live in
 * React state so a row can be added or removed, and the inputs are named
 * `slides.0.caption` so that what is posted is a document `formDocument` can
 * read back and zod can judge — and so a zod issue path is the name of the
 * input its message belongs under.
 *
 * The action is shared by all three (`saveSectionAction`), which is why every
 * form checks `state.section` before showing an outcome: React hands the same
 * state object to whichever form is asking.
 */

/** Both halves of `useActionState`, plus the errors for this section only. */
function useSection(section: string) {
  const [state, action, isPending] = React.useActionState<ContentActionState, FormData>(
    saveSectionAction,
    {},
  );
  const errors = state.section === section ? (state.fieldErrors ?? {}) : {};
  return { state, action, isPending, errors };
}

/** A 64px look at whatever address is in the row, so a wrong paste is obvious. */
function Thumb({ src }: { src: string }) {
  const valid = src.startsWith("/") || src.startsWith("https://");

  return (
    <div className="relative size-16 shrink-0 overflow-hidden border border-border bg-muted">
      {valid ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="64px"
          // The address can be any https host an admin pasted, and this is a
          // 64px thumbnail on a desk — not worth teaching the optimiser about.
          unoptimized
          className="object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageOff aria-hidden className="size-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/* --- hero ---------------------------------------------------------------- */

export function HeroForm({ value, stored }: { value: HeroContent; stored: boolean }) {
  const { state, action, isPending, errors } = useSection("hero");
  const [heading, setHeading] = React.useState(value.heading);
  const [primary, setPrimary] = React.useState(value.primaryCta);
  const [secondary, setSecondary] = React.useState(value.secondaryCta);
  const slides = useRows(value.slides);

  return (
    <SectionShell
      section="hero"
      title={CONTENT_SECTIONS.hero.title}
      blurb={CONTENT_SECTIONS.hero.blurb}
      stored={stored}
      state={state}
      isPending={isPending}
      action={action}
    >
      <Field
        name="heading"
        label="Гарчиг"
        value={heading}
        onChange={setHeading}
        error={errors.heading}
        hint="Зургийн өмнө гарах томоохон бичиг."
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[0.6875rem] tracking-[0.14em] uppercase">Зурагнууд</legend>
        <p className="text-[0.75rem] leading-snug text-muted-foreground">
          Дарааллаараа эргэлдэнэ. Тайлбар нь гарчгийн доор, зургийн тайлбар нь
          дэлгэц уншигчид зориулагдана.
        </p>

        {slides.rows.map((row, index) => (
          <div
            key={row.id}
            className="flex items-start gap-3 border border-border bg-muted/30 p-3"
          >
            <Thumb src={row.value.src} />

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <Field
                  name={`slides.${index}.src`}
                  label="Зураг"
                  value={row.value.src}
                  onChange={(src) => slides.update(row.id, { src })}
                  error={errors[`slides.${index}.src`]}
                  placeholder="/brand/kv-amjilt.jpg"
                  className="min-w-56 flex-1"
                />
                <ImageUpload
                  folder="hero"
                  label="Байршуулах"
                  onUploaded={(src) =>
                    slides.update(row.id, { src })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  name={`slides.${index}.caption`}
                  label="Тайлбар"
                  value={row.value.caption}
                  onChange={(caption) =>
                    slides.update(row.id, {
                      caption,
                    })
                  }
                  error={errors[`slides.${index}.caption`]}
                />
                <Field
                  name={`slides.${index}.alt`}
                  label="Зургийн тайлбар (alt)"
                  value={row.value.alt}
                  onChange={(alt) =>
                    slides.update(row.id, { alt })
                  }
                  error={errors[`slides.${index}.alt`]}
                />
              </div>
            </div>

            <RowRemove label={`${index + 1}-р зургийг хасах`} onClick={() => slides.remove(row.id)} />
          </div>
        ))}

        <RowAdd
          label="Зураг нэмэх"
          disabled={slides.rows.length >= CONTENT_LIMITS.slides}
          onClick={() => slides.add({ src: "", caption: "", alt: "" })}
        />
      </fieldset>

      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Field
            name="primaryCta.label"
            label="Үндсэн товч"
            value={primary.label}
            onChange={(label) => setPrimary((current) => ({ ...current, label }))}
            error={errors["primaryCta.label"]}
            hint="Нээлттэй ажлын байрны тоо энэ бичгийн өмнө автоматаар гарна."
          />
          <Field
            name="primaryCta.href"
            label="Үндсэн товчны холбоос"
            value={primary.href}
            onChange={(href) => setPrimary((current) => ({ ...current, href }))}
            error={errors["primaryCta.href"]}
            placeholder="/careers"
          />
        </div>

        <div className="flex flex-col gap-3">
          <Field
            name="secondaryCta.label"
            label="Хоёрдогч товч"
            value={secondary.label}
            onChange={(label) => setSecondary((current) => ({ ...current, label }))}
            error={errors["secondaryCta.label"]}
          />
          <Field
            name="secondaryCta.href"
            label="Хоёрдогч товчны холбоос"
            value={secondary.href}
            onChange={(href) => setSecondary((current) => ({ ...current, href }))}
            error={errors["secondaryCta.href"]}
            placeholder="/about"
          />
        </div>
      </div>
    </SectionShell>
  );
}

/* --- footer -------------------------------------------------------------- */

export function FooterForm({ value, stored }: { value: FooterContent; stored: boolean }) {
  const { state, action, isPending, errors } = useSection("footer");
  const [address, setAddress] = React.useState(value.address);
  const [addressUrl, setAddressUrl] = React.useState(value.addressUrl ?? "");
  const contacts = useRows(value.contacts);

  return (
    <SectionShell
      section="footer"
      title={CONTENT_SECTIONS.footer.title}
      blurb={CONTENT_SECTIONS.footer.blurb}
      stored={stored}
      state={state}
      isPending={isPending}
      action={action}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="address"
          label="Хаяг"
          value={address}
          onChange={setAddress}
          error={errors.address}
        />
        <Field
          name="addressUrl"
          label="Газрын зургийн холбоос"
          value={addressUrl}
          onChange={setAddressUrl}
          error={errors.addressUrl}
          hint="Хоосон орхивол хаяг холбоосгүй бичигдэнэ."
          placeholder="https://www.google.com/maps?cid=…"
        />
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-border pt-5">
        <legend className="text-[0.6875rem] tracking-[0.14em] uppercase">Холбоо барих</legend>
        <p className="text-[0.75rem] leading-snug text-muted-foreground">
          Хөлийн баганад бичигдсэн дарааллаараа гарна. Утас `tel:`, и-мэйл
          `mailto:`, сошиал хуудас `https://` холбоостой байна.
        </p>

        {contacts.rows.map((row, index) => (
          <div key={row.id} className="flex items-end gap-3">
            <Field
              name={`contacts.${index}.label`}
              label="Нэр"
              value={row.value.label}
              onChange={(label) =>
                contacts.update(row.id, { label })
              }
              error={errors[`contacts.${index}.label`]}
              className="w-32 shrink-0"
            />
            <Field
              name={`contacts.${index}.value`}
              label="Утга"
              value={row.value.value}
              onChange={(next) =>
                contacts.update(row.id, {
                  value: next,
                })
              }
              error={errors[`contacts.${index}.value`]}
              className="min-w-40 flex-1"
            />
            <Field
              name={`contacts.${index}.href`}
              label="Холбоос"
              value={row.value.href ?? ""}
              onChange={(href) =>
                contacts.update(row.id, { href })
              }
              error={errors[`contacts.${index}.href`]}
              className="min-w-48 flex-1"
            />
            <RowRemove label={`${row.value.label || index + 1}-г хасах`} onClick={() => contacts.remove(row.id)} />
          </div>
        ))}

        <RowAdd
          label="Мөр нэмэх"
          disabled={contacts.rows.length >= CONTENT_LIMITS.contacts}
          onClick={() => contacts.add({ label: "", value: "", href: "" })}
        />
      </fieldset>
    </SectionShell>
  );
}

/* --- about statistics ---------------------------------------------------- */

export function AboutStatsForm({
  value,
  stored,
}: {
  value: AboutStatsContent;
  stored: boolean;
}) {
  const { state, action, isPending, errors } = useSection("about_stats");
  const [heading, setHeading] = React.useState(value.heading);
  const items = useRows(value.items);

  return (
    <SectionShell
      section="about_stats"
      title={CONTENT_SECTIONS.about_stats.title}
      blurb={CONTENT_SECTIONS.about_stats.blurb}
      stored={stored}
      state={state}
      isPending={isPending}
      action={action}
    >
      <Field
        name="heading"
        label="Гарчиг"
        value={heading}
        onChange={setHeading}
        error={errors.heading}
        hint="Оныг агуулдаг тул үзүүлэлт шинэчлэх бүрд хамт шалгана уу."
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[0.6875rem] tracking-[0.14em] uppercase">Үзүүлэлтүүд</legend>
        <p className="text-[0.75rem] leading-snug text-muted-foreground">
          Тоог бичсэн хэвээр нь харуулна - таслал, хувийн тэмдэг хамт.
        </p>

        {items.rows.map((row, index) => (
          <div key={row.id} className="flex items-end gap-3">
            <Field
              name={`items.${index}.value`}
              label="Тоо"
              value={row.value.value}
              onChange={(next) =>
                items.update(row.id, {
                  value: next,
                })
              }
              error={errors[`items.${index}.value`]}
              className="w-32 shrink-0"
              inputClassName="tabular-nums"
            />
            <Field
              name={`items.${index}.label`}
              label="Тайлбар"
              value={row.value.label}
              onChange={(label) =>
                items.update(row.id, { label })
              }
              error={errors[`items.${index}.label`]}
              className="min-w-48 flex-1"
            />
            <RowRemove
              label={`${row.value.label || index + 1}-г хасах`}
              onClick={() => items.remove(row.id)}
            />
          </div>
        ))}

        <RowAdd
          label="Үзүүлэлт нэмэх"
          disabled={items.rows.length >= CONTENT_LIMITS.stats}
          onClick={() => items.add({ value: "", label: "" })}
        />
      </fieldset>
    </SectionShell>
  );
}
