"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, X } from "lucide-react";

import { saveSectionAction, type ContentActionState } from "@/app/admin/content/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  AboutStatsPreview,
  CulturePreview,
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
import { Button } from "@/components/ui/button";
import { CONTENT_LIMITS, CULTURE_WALLS } from "@/lib/content/schema";
import type {
  AboutStatsContent,
  CultureContent,
  CultureTile,
  CultureWall,
  FooterContent,
  HeroContent,
} from "@/lib/content/schema";
import { cn } from "@/lib/utils";
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

/* --- culture wall -------------------------------------------------------- */

/**
 * One tile of a culture wall: folded to its picture and title until it is
 * opened, because a wall is a dozen of these and three walls unfolded are a
 * page nobody can find anything on.
 *
 * Folded is `hidden`, not unmounted — the inputs still post, so a save sends
 * every tile whether or not it was opened. A tile the last save refused
 * opens by itself, so the message is never inside a fold.
 */
function TileEditor({
  base,
  tile,
  errors,
  onChange,
}: {
  /** The input-name prefix, `walls.academy.items.3`. */
  base: string;
  tile: CultureTile;
  errors: Record<string, string>;
  onChange: (patch: Partial<CultureTile>) => void;
}) {
  const failed = Object.keys(errors).some((key) => key.startsWith(`${base}.`));
  const [open, setOpen] = React.useState(!tile.title);
  const shown = open || failed;
  const cover = tile.logo ?? tile.images[0] ?? "";

  const setImage = (index: number, src: string) =>
    onChange({ images: tile.images.map((image, at) => (at === index ? src : image)) });
  const moveImage = (index: number, to: number) => {
    if (to < 0 || to >= tile.images.length) return;
    const images = [...tile.images];
    const [moved] = images.splice(index, 1);
    images.splice(to, 0, moved);
    onChange({ images });
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Thumb
          src={cover}
          className={cn("h-12 w-10", tile.logo && "w-16 bg-white [&_img]:object-contain")}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-medium">{tile.title || "Гарчиггүй"}</p>
          <p className="text-[0.75rem] text-muted-foreground">
            {tile.images.length} зураг{tile.logo ? " · лого" : ""}
            {tile.body ? "" : " · тайлбаргүй"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={shown}
          aria-controls={`${base}-fields`}
          disabled={failed}
          className="h-[38px] text-[0.8125rem]"
        >
          {shown ? "Хураах" : "Засах"}
          <ChevronDown aria-hidden className={cn("transition-transform", shown && "rotate-180")} />
        </Button>
      </div>

      <div id={`${base}-fields`} hidden={!shown} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name={`${base}.title`}
            label="Гарчиг"
            value={tile.title}
            onChange={(title) => onChange({ title })}
            error={errors[`${base}.title`]}
          />
          <Field
            name={`${base}.subtitle`}
            label="Дэд гарчиг"
            value={tile.subtitle ?? ""}
            onChange={(subtitle) => onChange({ subtitle })}
            error={errors[`${base}.subtitle`]}
            hint="Заавал биш. Цонхонд гарчгийн доор гарна."
          />
        </div>

        <Field
          name={`${base}.body`}
          label="Тайлбар"
          value={tile.body ?? ""}
          onChange={(body) => onChange({ body })}
          error={errors[`${base}.body`]}
          hint="Зураг дээр дарахад нээгдэх цонхны бичвэр. Хоосон бол «удахгүй нэмэгдэнэ» гэж гарна."
          multiline
        />

        <div className="flex flex-col gap-2">
          <p className="text-[0.6875rem] tracking-[0.14em] uppercase">Зурагнууд</p>
          <p className="-mt-1 text-[0.75rem] leading-snug text-muted-foreground">
            Эхний зураг хананд харагдана, бусад нь цонхонд дараалан гүйнэ.
          </p>

          {tile.images.map((src, index) => (
            <div key={index} className="flex items-end gap-2">
              <Thumb src={src} className="size-[38px]" />
              <Field
                name={`${base}.images.${index}`}
                label={`${index + 1}-р зураг`}
                value={src}
                onChange={(next) => setImage(index, next)}
                error={errors[`${base}.images.${index}`]}
                placeholder="/academy/hall.jpg"
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                disabled={index === 0}
                onClick={() => moveImage(index, index - 1)}
                aria-label={`${index + 1}-р зургийг дээш зөөх`}
                title="Дээш зөөх"
                className="text-muted-foreground"
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                disabled={index === tile.images.length - 1}
                onClick={() => moveImage(index, index + 1)}
                aria-label={`${index + 1}-р зургийг доош зөөх`}
                title="Доош зөөх"
                className="text-muted-foreground"
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => onChange({ images: tile.images.filter((_, at) => at !== index) })}
                aria-label={`${index + 1}-р зургийг хасах`}
                title="Хасах"
                className="text-muted-foreground hover:text-destructive"
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}

          {errors[`${base}.images`] && (
            <p role="alert" className="text-[0.8125rem] text-destructive">
              {errors[`${base}.images`]}
            </p>
          )}

          <div className="flex flex-wrap items-start gap-2">
            <RowAdd
              label="Холбоосоор нэмэх"
              disabled={tile.images.length >= CONTENT_LIMITS.tileImages}
              onClick={() => onChange({ images: [...tile.images, ""] })}
            />
            {tile.images.length < CONTENT_LIMITS.tileImages && (
              <ImageUpload
                folder="culture"
                label="Зураг байршуулах"
                onUploaded={(url) => onChange({ images: [...tile.images, url] })}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field
            name={`${base}.logo`}
            label="Лого"
            value={tile.logo ?? ""}
            onChange={(logo) => onChange({ logo })}
            error={errors[`${base}.logo`]}
            hint="Заавал биш. Клубын өргөн лого - хананд зургийн оронд цагаан дэвсгэр дээр бүтнээрээ гарна."
            placeholder="/clubs/sport.png"
            className="min-w-56 flex-1"
          />
          <ImageUpload
            folder="culture"
            label="Лого байршуулах"
            onUploaded={(logo) => onChange({ logo })}
          />
        </div>
      </div>
    </>
  );
}

/**
 * "Бидэнтэй нэгдсэнээр та": the heading, and the three walls behind the rail.
 *
 * One form and one save for all three walls, switched between by tabs the way
 * the public section switches them. The walls that are not showing are
 * `hidden`, not unmounted, so saving from the Academy tab still posts the
 * benefits and the clubs as they stand — the section is one row, and a save
 * that dropped two thirds of it would empty them. A wall holding a refused
 * field says so on its tab.
 *
 * The three `useRows` are written out rather than looped: they are hooks, and
 * there are exactly three walls, fixed by the schema.
 */
export function CultureForm({ value, stored }: { value: CultureContent; stored: boolean }) {
  const { state, action, isPending, errors, dirty, markDirty } = useSection("culture");
  const [heading, setHeading] = React.useState(value.heading);
  const [labels, setLabels] = React.useState<Record<CultureWall, string>>({
    academy: value.walls.academy.label,
    benefits: value.walls.benefits.label,
    clubs: value.walls.clubs.label,
  });
  const lists = {
    academy: useRows(value.walls.academy.items, markDirty),
    benefits: useRows(value.walls.benefits.items, markDirty),
    clubs: useRows(value.walls.clubs.items, markDirty),
  };
  const [active, setActive] = React.useState<CultureWall>("academy");

  const current: CultureContent = {
    heading,
    walls: {
      academy: { label: labels.academy, items: lists.academy.rows.map((row) => row.value) },
      benefits: { label: labels.benefits, items: lists.benefits.rows.map((row) => row.value) },
      clubs: { label: labels.clubs, items: lists.clubs.rows.map((row) => row.value) },
    },
  };

  const failing = (wall: CultureWall) =>
    Object.keys(errors).some((key) => key.startsWith(`walls.${wall}.`));

  return (
    <SectionShell
      section="culture"
      title={CONTENT_SECTIONS.culture.title}
      blurb={CONTENT_SECTIONS.culture.blurb}
      href={pageHref("culture")}
      stored={stored}
      state={state}
      isPending={isPending}
      dirty={dirty}
      onDirty={markDirty}
      action={action}
      preview={<CulturePreview value={current} active={active} walls={CULTURE_WALLS} />}
    >
      <Field
        name="heading"
        label="Гарчиг"
        value={heading}
        onChange={setHeading}
        error={errors.heading}
        hint="Хэсгийн дээд талд, хэсгүүдийн сонголтын дээр гарна."
      />

      <div role="tablist" aria-label="Хананууд" className="flex flex-wrap gap-1.5 border-t border-border pt-5">
        {CULTURE_WALLS.map((wall) => (
          <button
            key={wall}
            type="button"
            role="tab"
            id={`culture-tab-${wall}`}
            aria-selected={wall === active}
            aria-controls={`culture-wall-${wall}`}
            onClick={() => setActive(wall)}
            className={cn(
              "flex h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              wall === active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {labels[wall] || wall}
            <span className="tabular-nums opacity-60">{lists[wall].rows.length}</span>
            {failing(wall) && (
              <span aria-label="алдаатай" className="size-1.5 rounded-full bg-destructive" />
            )}
          </button>
        ))}
      </div>

      {CULTURE_WALLS.map((wall) => {
        const list = lists[wall];
        return (
          <div
            key={wall}
            id={`culture-wall-${wall}`}
            role="tabpanel"
            aria-labelledby={`culture-tab-${wall}`}
            hidden={wall !== active}
            className="flex flex-col gap-5"
          >
            <Field
              name={`walls.${wall}.label`}
              label="Хэсгийн нэр"
              value={labels[wall]}
              onChange={(label) => setLabels((current) => ({ ...current, [wall]: label }))}
              error={errors[`walls.${wall}.label`]}
              hint="Хэсгүүдийн сонголт дээр гарах нэр."
            />

            <FieldGroup
              legend="Зурагнууд"
              hint="Бөмбөрцөг хананд энэ дарааллаар байрлана. Зураг бүр дээр дарахад гарчиг, тайлбар, бүх зураг нь нээгдэнэ."
            >
              {errors[`walls.${wall}.items`] && (
                <p role="alert" className="text-[0.8125rem] text-destructive">
                  {errors[`walls.${wall}.items`]}
                </p>
              )}

              {list.rows.map((row, index) => (
                <Row
                  key={row.id}
                  index={index}
                  total={list.rows.length}
                  removeLabel={`${row.value.title || index + 1}-г хасах`}
                  onRemove={() => list.remove(row.id)}
                  onMove={(to) => list.move(row.id, to)}
                >
                  <TileEditor
                    base={`walls.${wall}.items.${index}`}
                    tile={row.value}
                    errors={errors}
                    onChange={(patch) => list.update(row.id, patch)}
                  />
                </Row>
              ))}

              <RowAdd
                label="Зураг нэмэх"
                disabled={list.rows.length >= CONTENT_LIMITS.tiles}
                onClick={() => list.add({ title: "", images: [] })}
              />
            </FieldGroup>
          </div>
        );
      })}
    </SectionShell>
  );
}
