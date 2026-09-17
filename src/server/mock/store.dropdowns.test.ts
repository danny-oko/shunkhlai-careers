import { describe, expect, it } from "vitest";

import { dropdownRows } from "./store";

/**
 * The mock's dependent dropdowns.
 *
 * `GOAL.md` says production still runs on this mock, so what it answers *is*
 * the cascade as far as an applicant is concerned. It used to accept
 * `countryid`, `divisionid` and `skillcompid` and throw them away: every
 * country offered every province, every province every district, every skill
 * every level. The child list reloaded on each parent change and came back
 * identical, which is the one thing a dependent dropdown must not do.
 *
 * The three filters also have to narrow together — a combobox with a country
 * chosen and a word typed means both at once, and resolving a saved id has to
 * stay inside the parent it was saved under.
 */

const query = (search: string) => new URLSearchParams(search);
const labels = (rows: Array<Record<string, unknown>>) => rows.map((row) => String(row.text));
const keys = (rows: Array<Record<string, unknown>>) => rows.map((row) => Number(row.key));

describe("parent filtering", () => {
  it("offers a different province list per country", () => {
    const mongolia = dropdownRows("GetDivisionDropDown", query("countryid=496"));
    const korea = dropdownRows("GetDivisionDropDown", query("countryid=3"));

    expect(labels(mongolia)).toContain("Улаанбаатар");
    expect(labels(korea)).toContain("Сөүл");

    expect(labels(mongolia)).not.toContain("Сөүл");
    expect(labels(korea)).not.toContain("Улаанбаатар");
    expect(mongolia.length).toBeGreaterThan(0);
    expect(korea.length).toBeGreaterThan(0);
  });

  it("offers a different district list per province", () => {
    const ulaanbaatar = dropdownRows("GetDistrictDropDown", query("divisionid=1"));
    const umnugovi = dropdownRows("GetDistrictDropDown", query("divisionid=5"));

    expect(labels(ulaanbaatar)).toContain("Баянгол");
    expect(labels(umnugovi)).toContain("Цогтцэций");
    expect(labels(umnugovi)).not.toContain("Баянгол");
  });

  it("offers a different level list per computer skill", () => {
    const word = dropdownRows("GetSkillCompLevelDropDown", query("skillcompid=3"));
    const sql = dropdownRows("GetSkillCompLevelDropDown", query("skillcompid=14"));

    expect(word.length).toBeGreaterThan(0);
    expect(sql.length).toBeGreaterThan(0);
    // Keys are unique across skills, so a level chosen under one skill is
    // never a level of another — which is why the child has to be cleared.
    expect(keys(word).some((key) => keys(sql).includes(key))).toBe(false);
  });

  it("treats countryid=0 as every university, per the collection", () => {
    const all = dropdownRows("GetUniversityDropDown", query("countryid=0"));
    const mongolia = dropdownRows("GetUniversityDropDown", query("countryid=496"));

    expect(all.length).toBeGreaterThan(mongolia.length);
    expect(labels(all)).toContain("Харвардын Их Сургууль");
    expect(labels(mongolia)).not.toContain("Харвардын Их Сургууль");
  });

  it("treats a missing countryid the same as 0", () => {
    expect(dropdownRows("GetUniversityDropDown", query("")).length).toBe(
      dropdownRows("GetUniversityDropDown", query("countryid=0")).length,
    );
  });

  it("offers nothing when a required parent is absent", () => {
    // `divisionid` and `skillcompid` are заавал: no parent chosen is not the
    // same question as "all of them".
    expect(dropdownRows("GetDistrictDropDown", query(""))).toEqual([]);
    expect(dropdownRows("GetDistrictDropDown", query("divisionid=0"))).toEqual([]);
    expect(dropdownRows("GetSkillCompLevelDropDown", query("skillcompid=0"))).toEqual([]);
  });

  it("keeps the parent column off the wire", () => {
    const [row] = dropdownRows("GetDivisionDropDown", query("countryid=496"));
    expect(row).toBeDefined();
    expect(Object.keys(row).sort()).toEqual(["key", "row_index", "text"]);
  });

  it("leaves an independent list alone", () => {
    expect(dropdownRows("GetRelativeDropDown", query("countryid=3")).length).toBeGreaterThan(0);
  });
});

describe("filters compose", () => {
  it("narrows by parent and search together", () => {
    const rows = dropdownRows("GetUniversityDropDown", query("countryid=496&search=их сургууль"));

    expect(rows.length).toBeGreaterThan(0);
    for (const label of labels(rows)) expect(label.toLowerCase()).toContain("их сургууль");
    expect(labels(rows)).not.toContain("Харвардын Их Сургууль");
  });

  it("finds nothing when the search matches only outside the parent", () => {
    expect(dropdownRows("GetDivisionDropDown", query("countryid=496&search=Сөүл"))).toEqual([]);
  });

  it("narrows by parent and ids together", () => {
    // 67 and 68 are Mongolian, 160 is not — the resolution of a saved value
    // must not reach past the country it was saved under.
    const inside = dropdownRows("GetUniversityDropDown", query("countryid=496&ids=67&ids=68"));
    expect(keys(inside).sort((a, b) => a - b)).toEqual([67, 68]);

    const outside = dropdownRows("GetUniversityDropDown", query("countryid=496&ids=160"));
    expect(outside).toEqual([]);
  });

  it("resolves the same ids across every country when countryid is 0", () => {
    const rows = dropdownRows("GetUniversityDropDown", query("countryid=0&ids=67&ids=160"));
    expect(keys(rows).sort((a, b) => a - b)).toEqual([67, 160]);
  });

  it("applies ids and search at once rather than one instead of the other", () => {
    const rows = dropdownRows(
      "GetUniversityDropDown",
      query("countryid=0&ids=67&ids=68&search=МХСС"),
    );
    expect(keys(rows)).toEqual([67]);
  });

  it("ignores an empty ids parameter, as the collection sends it", () => {
    const rows = dropdownRows("GetDivisionDropDown", query("countryid=496&search=&ids=&lfr=false"));
    expect(rows.length).toBeGreaterThan(1);
  });

  it("caps a parent-filtered list at five rows for lfr", () => {
    const rows = dropdownRows("GetDistrictDropDown", query("divisionid=1&lfr=true"));
    expect(rows).toHaveLength(5);
  });

  it("numbers rows from one within the filtered set", () => {
    const rows = dropdownRows("GetDistrictDropDown", query("divisionid=5"));
    expect(rows.map((row) => row.row_index)).toEqual([1, 2, 3, 4]);
  });
});
