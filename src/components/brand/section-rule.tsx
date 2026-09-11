/**
 * The brandbook кант, as a hairline across the top of a section.
 *
 * Every place one section meets the next carries this rather than a neutral
 * border, so the seams read as part of the brand rather than as table rules.
 * The parent must be positioned — every section it is used in already is, or
 * is given `relative` alongside it.
 */
export function SectionRule() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 z-10 h-px"
      style={{ backgroundImage: "var(--brand-gradient)" }}
    />
  );
}
