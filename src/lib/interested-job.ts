/**
 * What makes two interested-job rows the same request (SaveInterestedJobItem):
 * the group and the position, a group-only interest being the group with no
 * position. Shared by the page (`app/account/interests/page.tsx`) and the
 * `/api/me` handler, so both refuse the same duplicate with the same words.
 */

export const INTEREST_GROUP_REQUIRED_MESSAGE = "Албан тушаалын бүлгээ сонгоно уу.";

export const INTEREST_DUPLICATE_MESSAGE = "Энэ ажлын байрыг аль хэдийн бүртгүүлсэн байна.";

type InterestIds = { posgroupid?: unknown; positionid?: unknown };

/** An id as the ERP may hand it back: `142` and `"142"` alike, null / "" / 0 as none. */
const idOf = (value: unknown) => {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : 0;
};

export function sameInterest(a: InterestIds, b: InterestIds): boolean {
  return idOf(a.posgroupid) === idOf(b.posgroupid) && idOf(a.positionid) === idOf(b.positionid);
}
