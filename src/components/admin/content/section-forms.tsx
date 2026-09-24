"use client";

import * as React from "react";

import { saveSectionAction, type ContentActionState } from "@/app/admin/content/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  AboutStatsPreview,
  FooterPreview,
  HeroPreview,
  Thumb,
} from "@/components/admin/content/section-preview";
import {
  Field,
  FieldGroup,
  Row,
  RowAdd,
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
 * React state so a row can be added, removed or moved, and the inputs are
 * named `slides.0.caption` so that what is posted is a document `formDocument`
 * can read back and zod can judge — and so a zod issue path is the name of the
 * input its message belongs under.
 *
 * The action is shared by all three (`saveSectionAction`), which is why every
 * form checks `state.section` before showing an outcome: React hands the same
 * state object to whichever form is asking.
 *
 * Because the state is controlled, the panel can also draw the section as it
 * will look — `HeroPreview` and the two beside it read the same values the
 * inputs do, and redraw as they are typed.
 */

/**
 * One section's plumbing: the action, its state, and whether the form has been
 * edited since the last save.
 *
 * `dirty` is the form's own memory rather than a comparison against the
 * loaded document. Deep-comparing three nested documents on every keystroke
 * would be the accurate answer to a question the save bar does not need
 * answered that precisely: "you have touched this and not saved it" is what
 * an admin is being told, and typing a character back the way it was does not
 * make that untrue.
 */
function useSection(section: string) {
  const [state, action, isPending] = React.useActionState<ContentActionState, FormData>(
    saveSectionAction,
    {},
  );
  const [dirty, setDirty] = React.useState(false);
  const markDirty = React.useCallback(() => setDirty(true), []);

  // A successful save of *this* section means the form and the row agree
  // again. Another section's outcome says nothing about this one — the three
  // forms share one action, so `useActionState` hands all of them the same
  // object whichever one was submitted.
  //
  // Adjusted during the render that first sees a new state rather than in an
  // effect: an effect would paint "Хадгалаагүй өөрчлөлт" for one frame after
  // a save that had just succeeded, and React re-runs this render before the
  // browser sees any of it.
  const [seen, setSeen] = React.useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok && state.section === section) setDirty(false);
  }

  const errors = state.section === section ? (state.fieldErrors ?? {}) : {};
  return { state, action, isPending, errors, dirty, markDirty };
}

/** Where a section is printed, for the chip in the panel's head. */
function pageHref(section: keyof typeof CONTENT_SECTIONS): string {
  return CONTENT_SECTIONS[section].paths[0].path;
}

/* --- hero ---------------------------------------------------------------- */

export function HeroForm({ value, stored }: { value: HeroContent; stored: boolean }) {
  const { state, action, isPending, errors, dirty, markDirty } = useSection("hero");
  const [heading, setHeading] = React.useState(value.heading);
  const [primary, setPrimary] = React.useState(value.primaryCta);
  const [secondary, setSecondary] = React.useState(value.secondaryCta);
  const slides = useRows(value.slides, markDirty);

  return (
    <SectionShell
      section="hero"
      title={CONTENT_SECTIONS.hero.title}
      blurb={CONTENT_SECTIONS.hero.blurb}
      href={pageHref("hero")}
      stored={stored}
      state={state}
      isPending={isPending}
      dirty={dirty}
      onDirty={markDirty}
      action={action}
      preview={
        <HeroPreview
          value={{
            heading,
            slides: slides.rows.map((row) => row.value),
            primaryCta: primary,
            secondaryCta: secondary,
          }}
        />
      }
    >
      <Field
        name="heading"
        label="Гарчиг"
        value={heading}
        onChange={setHeading}
        error={errors.heading}
        hint="Зургийн өмнө гарах томоохон бичиг."
      />

      <FieldGroup
        legend="Зурагнууд"
        hint="Дарааллаараа эргэлдэнэ. Тайлбар нь гарчгийн доор, зургийн тайлбар нь дэлгэц уншигчид зориулагдана."
      >
        {slides.rows.map((row, index) => (
          <Row
            key={row.id}
            index={index}
            total={slides.rows.length}
            removeLabel={`${index + 1}-р зургийг хасах`}
            onRemove={() => slides.remove(row.id)}
            onMove={(to) => slides.move(row.id, to)}
          >
            <div className="flex items-start gap-3">
              <Thumb src={row.value.src} className="size-16" />

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
                    onUploaded={(src) => slides.update(row.id, { src })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    name={`slides.${index}.caption`}
                    label="Тайлбар"
                    value={row.value.caption}
                    onChange={(caption) => slides.update(row.id, { caption })}
                    error={errors[`slides.${index}.caption`]}
                  />
                  <Field
                    name={`slides.${index}.alt`}
                    label="Зургийн тайлбар (alt)"
                    value={row.value.alt}
                    onChange={(alt) => slides.update(row.id, { alt })}
                    error={errors[`slides.${index}.alt`]}
                  />
                </div>
              </div>
            </div>
          </Row>
        ))}

        <RowAdd
          label="Зураг нэмэх"
          disabled={slides.rows.length >= CONTENT_LIMITS.slides}
          onClick={() => slides.add({ src: "", caption: "", alt: "" })}
        />
      </FieldGroup>

      {/* The two buttons are one group, not four loose fields: each is a
          label and the address it goes to, and they are wrong together or
          right together. */}
      <FieldGroup legend="Товчнууд">
        {/* A row per button rather than a column per button. Stacked, the
            hint under the primary label pushed its address field half a line
            below the one beside it, and the two columns stopped reading as
            two pairs. Side by side, each row is one button: its words, then
            where it goes. */}
        <div className="flex flex-wrap items-start gap-3">
          <Field
            name="primaryCta.label"
            label="Үндсэн товч"
            value={primary.label}
            onChange={(label) => setPrimary((current) => ({ ...current, label }))}
            error={errors["primaryCta.label"]}
            hint="Нээлттэй ажлын байрны тоо энэ бичгийн өмнө автоматаар гарна."
            className="min-w-48 flex-1"
          />
          <Field
            name="primaryCta.href"
            label="Үндсэн товчны холбоос"
            value={primary.href}
            onChange={(href) => setPrimary((current) => ({ ...current, href }))}
            error={errors["primaryCta.href"]}
            placeholder="/careers"
            className="min-w-48 flex-1"
          />
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <Field
            name="secondaryCta.label"
            label="Хоёрдогч товч"
            value={secondary.label}
            onChange={(label) => setSecondary((current) => ({ ...current, label }))}
            error={errors["secondaryCta.label"]}
            className="min-w-48 flex-1"
          />
          <Field
            name="secondaryCta.href"
            label="Хоёрдогч товчны холбоос"
            value={secondary.href}
            onChange={(href) => setSecondary((current) => ({ ...current, href }))}
            error={errors["secondaryCta.href"]}
            placeholder="/about"
            className="min-w-48 flex-1"
          />
        </div>
      </FieldGroup>
    </SectionShell>
  );
}

/* --- footer -------------------------------------------------------------- */

export function FooterForm({ value, stored }: { value: FooterContent; stored: boolean }) {
  const { state, action, isPending, errors, dirty, markDirty } = useSection("footer");
  const [address, setAddress] = React.useState(value.address);
  const [addressUrl, setAddressUrl] = React.useState(value.addressUrl ?? "");
  const contacts = useRows(value.contacts, markDirty);

  return (
    <SectionShell
      section="footer"
      title={CONTENT_SECTIONS.footer.title}
      blurb={CONTENT_SECTIONS.footer.blurb}
      href={pageHref("footer")}
      stored={stored}
      state={state}
      isPending={isPending}
      dirty={dirty}
      onDirty={markDirty}
      action={action}
      preview={
        <FooterPreview
          value={{
            address,
            addressUrl: addressUrl || undefined,
            contacts: contacts.rows.map((row) => row.value),
          }}
        />
      }
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

      <FieldGroup
        legend="Холбоо барих"
        hint="Хөлийн баганад бичигдсэн дарааллаараа гарна. Утас `tel:`, и-мэйл `mailto:`, сошиал хуудас `https://` холбоостой байна."
      >
        {contacts.rows.map((row, index) => (
          <Row
            key={row.id}
            index={index}
            total={contacts.rows.length}
            removeLabel={`${row.value.label || index + 1}-г хасах`}
            onRemove={() => contacts.remove(row.id)}
            onMove={(to) => contacts.move(row.id, to)}
          >
            <div className="flex flex-wrap items-start gap-3">
              <Field
                name={`contacts.${index}.label`}
                label="Нэр"
                value={row.value.label}
                onChange={(label) => contacts.update(row.id, { label })}
                error={errors[`contacts.${index}.label`]}
                className="w-32 shrink-0"
              />
              <Field
                name={`contacts.${index}.value`}
                label="Утга"
                value={row.value.value}
                onChange={(next) => contacts.update(row.id, { value: next })}
                error={errors[`contacts.${index}.value`]}
                className="min-w-40 flex-1"
              />
              <Field
                name={`contacts.${index}.href`}
                label="Холбоос"
                value={row.value.href ?? ""}
                onChange={(href) => contacts.update(row.id, { href })}
                error={errors[`contacts.${index}.href`]}
                className="min-w-48 flex-1"
              />
            </div>
          </Row>
        ))}

        <RowAdd
          label="Мөр нэмэх"
          disabled={contacts.rows.length >= CONTENT_LIMITS.contacts}
          onClick={() => contacts.add({ label: "", value: "", href: "" })}
        />
      </FieldGroup>
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
  const { state, action, isPending, errors, dirty, markDirty } = useSection("about_stats");
  const [heading, setHeading] = React.useState(value.heading);
  const items = useRows(value.items, markDirty);

  return (
    <SectionShell
      section="about_stats"
      title={CONTENT_SECTIONS.about_stats.title}
      blurb={CONTENT_SECTIONS.about_stats.blurb}
      href={pageHref("about_stats")}
      stored={stored}
      state={state}
      isPending={isPending}
      dirty={dirty}
      onDirty={markDirty}
      action={action}
      preview={
        <AboutStatsPreview value={{ heading, items: items.rows.map((row) => row.value) }} />
      }
    >
      <Field
        name="heading"
        label="Гарчиг"
        value={heading}
        onChange={setHeading}
        error={errors.heading}
        hint="Оныг агуулдаг тул үзүүлэлт шинэчлэх бүрд хамт шалгана уу."
      />

      <FieldGroup
        legend="Үзүүлэлтүүд"
        hint="Тоог бичсэн хэвээр нь харуулна - таслал, хувийн тэмдэг хамт."
      >
        {items.rows.map((row, index) => (
          <Row
            key={row.id}
            index={index}
            total={items.rows.length}
            removeLabel={`${row.value.label || index + 1}-г хасах`}
            onRemove={() => items.remove(row.id)}
            onMove={(to) => items.move(row.id, to)}
          >
            <div className="flex flex-wrap items-start gap-3">
              <Field
                name={`items.${index}.value`}
                label="Тоо"
                value={row.value.value}
                onChange={(next) => items.update(row.id, { value: next })}
                error={errors[`items.${index}.value`]}
                className="w-32 shrink-0"
                inputClassName="tabular-nums"
              />
              <Field
                name={`items.${index}.label`}
                label="Тайлбар"
                value={row.value.label}
                onChange={(label) => items.update(row.id, { label })}
                error={errors[`items.${index}.label`]}
                className="min-w-48 flex-1"
              />
            </div>
          </Row>
        ))}

        <RowAdd
          label="Үзүүлэлт нэмэх"
          disabled={items.rows.length >= CONTENT_LIMITS.stats}
          onClick={() => items.add({ value: "", label: "" })}
        />
      </FieldGroup>
    </SectionShell>
  );
}
