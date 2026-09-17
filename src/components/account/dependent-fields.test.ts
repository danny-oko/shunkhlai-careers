import { describe, expect, it } from "vitest";

import { cascadeEdges, clearDependents, dependentsOf } from "./dependent-fields";

/**
 * What a parent change does to its children.
 *
 * The generic section form reloaded a child's options when a `deps` field
 * changed but left the child's own value alone, so changing Улс after picking
 * a Сургууль sent the previous country's university id to the save. The
 * standalone profile form had always cleared its chain by hand; this is that
 * behaviour, lifted, so every declared edge gets it.
 */

const EDUCATION = [
  { name: "countryid" },
  { name: "divisionid", deps: ["countryid"] },
  { name: "universityid", deps: ["countryid"] },
  { name: "professionid" },
];

const LOCATION = [
  { name: "countryid" },
  { name: "divisionid", deps: ["countryid"] },
  { name: "districtid", deps: ["divisionid"] },
];

describe("cascadeEdges", () => {
  it("reads the edges off the field descriptions", () => {
    expect(cascadeEdges(EDUCATION)).toEqual({ countryid: ["divisionid", "universityid"] });
  });

  it("describes a chain one level at a time", () => {
    expect(cascadeEdges(LOCATION)).toEqual({
      countryid: ["divisionid"],
      divisionid: ["districtid"],
    });
  });

  it("has no edges for a form with no dependent field", () => {
    expect(cascadeEdges([{ name: "orgname" }, { name: "jobid" }])).toEqual({});
  });
});

describe("dependentsOf", () => {
  it("walks the whole chain, not just the first level", () => {
    const edges = cascadeEdges(LOCATION);
    expect(dependentsOf("countryid", edges)).toEqual(["divisionid", "districtid"]);
    expect(dependentsOf("divisionid", edges)).toEqual(["districtid"]);
    expect(dependentsOf("districtid", edges)).toEqual([]);
  });

  it("terminates on a description that loops back on itself", () => {
    const edges = cascadeEdges([
      { name: "a", deps: ["b"] },
      { name: "b", deps: ["a"] },
    ]);
    expect(dependentsOf("a", edges)).toEqual(["b"]);
  });
});

describe("clearDependents", () => {
  it("clears a child when its parent changes", () => {
    const next = clearDependents(
      { countryid: "3", universityid: "67", divisionid: "1", professionid: "10" },
      "countryid",
      cascadeEdges(EDUCATION),
    );

    expect(next.universityid).toBe("");
    expect(next.divisionid).toBe("");
  });

  it("leaves everything that does not hang off the changed field", () => {
    const next = clearDependents(
      { countryid: "3", universityid: "67", professionid: "10", gpa: "3.4" },
      "countryid",
      cascadeEdges(EDUCATION),
    );

    expect(next.professionid).toBe("10");
    expect(next.gpa).toBe("3.4");
    expect(next.countryid).toBe("3");
  });

  it("clears a grandchild too", () => {
    // A district belongs to a province that no longer belongs to the country
    // above it, so Улс has to empty both.
    const next = clearDependents(
      { countryid: "496", divisionid: "1", districtid: "4" },
      "countryid",
      cascadeEdges(LOCATION),
    );

    expect(next).toEqual({ countryid: "496", divisionid: "", districtid: "" });
  });

  it("clears only below the field that changed", () => {
    const next = clearDependents(
      { countryid: "496", divisionid: "5", districtid: "4" },
      "divisionid",
      cascadeEdges(LOCATION),
    );

    expect(next).toEqual({ countryid: "496", divisionid: "5", districtid: "" });
  });

  it("returns the same object when nothing hangs off the change", () => {
    const values = { countryid: "496", divisionid: "1", districtid: "4" };
    expect(clearDependents(values, "districtid", cascadeEdges(LOCATION))).toBe(values);
  });

  it("clears the skill level when the skill changes", () => {
    const edges = cascadeEdges([
      { name: "skillcompid" },
      { name: "levelid", deps: ["skillcompid"] },
    ]);

    // Level 2 belongs to Word; under Excel the equivalent level is 5, so
    // carrying 2 across would save a level of a different skill.
    expect(clearDependents({ skillcompid: "4", levelid: "2" }, "skillcompid", edges)).toEqual({
      skillcompid: "4",
      levelid: "",
    });
  });
});
