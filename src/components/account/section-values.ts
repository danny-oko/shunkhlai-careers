/**
 * Pure helpers for the section forms: what an edit form starts with, and how
 * stored dates are read back. Kept out of the component so they are testable.
 */

/** The slice of a field description these helpers need. */
type FieldShape = { name: string; type: string };
type Values = Record<string, unknown>;

const DATE_SHAPE = /^\s*(\d{4})[-.](\d{2})[-.](\d{2})(?:[T\s].*)?$/u;

function matchDate(value: unknown): RegExpExecArray | null {
  return typeof value === "string" ? DATE_SHAPE.exec(value) : null;
}

/** Rejects 2024-02-31 and the like rather than letting them shift into March. */
function isRealDate(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/**
 * Any of the shapes the backend hands back — `YYYY-MM-DD`, an ISO datetime, or
 * the audit style `YYYY.MM.DD hh:mm:ss` — as `YYYY-MM-DD`; anything else is
 * `""`. The server stores whatever string it is sent, so a row written by
 * another client may be dotted, and an `<input type="date">` shows nothing for
 * that. Saving always sends the ISO form.
 */
export function toIsoDate(value: unknown): string {
  const match = matchDate(value);
  if (!match) return "";
  const [, year, month, day] = match;
  return isRealDate(Number(year), Number(month), Number(day)) ? `${year}-${month}-${day}` : "";
}

/** The backend answers `0` for a reference id that was never sent. */
function emptyIdToBlank(value: unknown): unknown {
  return value === 0 || value === "0" ? "" : value;
}

/**
 * How a saved value becomes an input value, by field type. An id of `0` is
 * "empty" — it must not become a select value — and dates are normalised for
 * the input.
 */
const PREFILL: Record<string, (value: unknown) => unknown> = {
  select: emptyIdToBlank,
  combobox: emptyIdToBlank,
  date: toIsoDate,
};

function prefillField(values: Values, field: FieldShape): void {
  const prefill = PREFILL[field.type];
  if (prefill && field.name in values) values[field.name] = prefill(values[field.name]);
}

/**
 * The values an entry form opens with.
 *
 * A new entry starts from `defaults`. An edit starts from the saved row alone:
 * a default (say, the home country) filling a key the row lacks would show a
 * value the applicant never saved.
 */
export function initialValues(
  fields: FieldShape[],
  defaults: Values,
  editing: Values | "new",
): Values {
  if (editing === "new") return { ...defaults, entryid: 0 };

  const values: Values = { ...editing };
  fields.forEach((field) => prefillField(values, field));
  return values;
}
