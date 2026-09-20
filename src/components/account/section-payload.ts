/**
 * What a section form sends. Kept out of the component so it is testable.
 *
 * The live backend (probed 2026-09, education / experience / language) treats
 * an id or decimal column three ways when the form left it empty:
 *
 *   - `null`  → HTTP 400 for `countryid`, `divisionid`, `headjobid` and
 *               `basewage` ("Error converting value {null} to type
 *               System.Decimal"); accepted, stored as null, for the rest.
 *   - omitted → accepted everywhere. A NOT NULL column stores 0, a nullable one
 *               stays null — so an unchanged empty field does not drift.
 *   - `0`     → accepted everywhere, and stored as an explicit 0.
 *
 * So an empty numeric field is omitted by default, never sent as `null`, and
 * never coerced through `Number(null)`. A field can opt into `"zero"`.
 */

export type EmptyAs = "omit" | "zero";

type Values = Record<string, unknown>;
type PayloadField = { name: string; type: string; emptyAs?: EmptyAs };

/** Field types whose value is a number on the wire. */
const NUMERIC_TYPES = new Set(["number", "select", "combobox"]);

function cellText(raw: unknown): string {
  return String(raw ?? "").trim();
}

/** A finite number, or `null` when the input is empty or not numeric. */
function toNumber(raw: unknown): number | null {
  const text = cellText(raw);
  const number = text === "" ? Number.NaN : Number(text);
  return Number.isFinite(number) ? number : null;
}

function encodeField(payload: Values, field: PayloadField): void {
  const number = toNumber(payload[field.name]);
  if (number !== null) payload[field.name] = number;
  else if (field.emptyAs === "zero") payload[field.name] = 0;
  else delete payload[field.name];
}

/** The body for a section save: numeric fields as numbers, empty ones per `emptyAs`. */
export function encodeSectionValues(fields: PayloadField[], values: Values): Values {
  const payload: Values = { entryid: 0, ...values };
  for (const field of fields) if (NUMERIC_TYPES.has(field.type)) encodeField(payload, field);
  return payload;
}
