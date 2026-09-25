import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";

/**
 * How the hosted `<SignIn>` and `<SignUp>` cards wear the site's own skin.
 *
 * Everything here is spent as a CSS variable rather than a literal colour, and
 * that is the whole point: the site has a light/dark class on <html>
 * and Clerk's card has to be right in both. A hex value copied out of
 * `globals.css` would be right in only one. Clerk resolves these against the
 * element it renders into, so the card re-colours itself the moment the theme
 * changes, with no JavaScript of ours involved.
 *
 * The other half of the mechanism is `cssLayerName`. Clerk ships its stylesheet
 * from its CDN at runtime and, unlayered, it would beat every Tailwind utility
 * in `elements` below - the same trap `.news-body` documents in `globals.css`.
 * Naming a layer here only works because `globals.css` declares `clerk` first
 * in the layer order; the two have to be changed together.
 */
type ClerkAppearance = NonNullable<
  ComponentProps<typeof ClerkProvider>["appearance"]
>;

export const clerkAppearance: ClerkAppearance = {
  cssLayerName: "clerk",

  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--card)",
    colorForeground: "var(--foreground)",
    colorMuted: "var(--muted)",
    colorMutedForeground: "var(--muted-foreground)",
    /* The card sits on `--card`, so its inputs take the page ground to keep the
       two surfaces apart - the same inversion the site's own `<Input>` makes
       with `bg-transparent` on a card. */
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorRing: "var(--ring)",
    colorDanger: "var(--destructive)",
    /* Clerk derives hover fills and dividers from this one; the foreground is
       the only token that is dark on a light palette and light on a dark one,
       which is exactly the contract this variable asks for. */
    colorNeutral: "var(--foreground)",

    fontFamily: "var(--app-font-sans)",
    fontFamilyMono: "var(--font-ubuntu-mono)",
    borderRadius: "var(--radius)",
  },

  options: {
    /* The site header already carries the logo two rows above the card. */
    logoPlacement: "none",
    /* Full-width provider buttons: "Google-ээр үргэлжлүүлэх" is a sentence, not
       an icon's worth of room. */
    socialButtonsVariant: "blockButton",
  },

  elements: {
    /* The site's own card edge, in place of Clerk's deeper drop shadow. The
       `elevation: "flush"` option looks like the way to ask for this and is
       not: it flattens the card itself, taking its 32/40 padding and the
       ring every input and provider button draws its border with. */
    cardBox: "rounded-2xl border border-border/70 shadow-xs",
    headerTitle: "type-title font-heading font-semibold tracking-tight",
    headerSubtitle: "type-copy text-muted-foreground",
    dividerLine: "bg-border/70",
    dividerText: "type-kicker tracking-[0.18em] uppercase",
    /* Clerk draws these edges as a 1px box-shadow ring in a colour it derives
       itself, which lands near-invisible on white. A real border is the site's
       own edge and, unlike a `ring-*` utility, leaves Clerk's focus ring - the
       same box-shadow - to do its job. */
    socialButtonsBlockButton: "rounded-lg border border-border/70",
    formFieldLabel: "text-sm font-medium",
    formFieldInput: "rounded-lg border border-input",
    /* `active:translate-y-px` is the press the site's own buttons make. */
    formButtonPrimary: "rounded-lg text-sm font-medium active:translate-y-px",
    otpCodeFieldInput: "rounded-lg font-mono",
    /* The scrim behind the header's sign-in dialog, matching what `ui/dialog`
       and `ui/sheet` already drop over this site. Clerk would otherwise tint
       it with `colorNeutral` at 73%, and that token is the foreground - which
       is near-white in dark mode, so the page would go pale rather than dim. */
    modalBackdrop: "bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
    /* "Бүртгэл байхгүй юу? Бүртгүүлэх" sits on the footer's muted ground, and
       `colorPrimary` would paint the link brand orange there: measured 3.25:1
       on the brandbook palette, under AA. The site's
       own foreground carries it instead, with the brand kept for the hover. */
    footerActionLink: "font-medium text-foreground hover:text-primary",
  },
};
