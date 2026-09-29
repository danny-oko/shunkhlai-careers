import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminIdentity } from "@/server/admin/store";

/**
 * Who may take an applicant's CV off the desk, and what comes back.
 *
 * This route is the only way a file belonging to somebody who is not the
 * signed-in user leaves this site, so the first four tests are the gate and
 * nothing else: a route handler is a bare GET, no layout runs for it, and the
 * page's own `requireAdminUser()` protects nothing on this path. The real
 * `mayViewApplicantData` is used — only `currentAdmin` is replaced — so what is
 * under test is this route's decision rather than a mock of the rule.
 *
 * Everything with a side effect is a spy. Nothing reaches a database, a disk or
 * the ERP.
 */

const memory = vi.hoisted(() => ({
  user: null as AdminIdentity | null,
  resolved: null as { email: string; entryid: number } | null,
  cv: null as { filename: string; data: string } | null,
  picture: null as string | null,
  /** Which account the file reads were asked for. */
  read: [] as string[],
  throws: false,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/admin/guard", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/admin/guard")>("@/server/admin/guard");
  return { ...actual, currentAdmin: async () => memory.user };
});

// `@/server/admin/guard`'s real module reaches for these; nothing under test
// calls them, and a stub keeps the database and the cookie jar out of it.
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

vi.mock("@/server/applicant/application-desk", () => ({
  resolveApplication: async (key: string) => (key === "known-key" ? memory.resolved : null),
}));

vi.mock("@/server/applicant/account-store", () => ({
  readCv: async (email: string) => {
    memory.read.push(`cv:${email}`);
    if (memory.throws) throw new Error("upload directory unreadable");
    return memory.cv;
  },
  readPicture: async (email: string) => {
    memory.read.push(`picture:${email}`);
    if (memory.throws) throw new Error("upload directory unreadable");
    return memory.picture;
  },
}));

import { GET } from "./route";

const ADMIN: AdminIdentity = {
  id: "u_1",
  name: "Админ",
  email: "hr@shunkhlai.mn",
  role: "admin",
  source: "app_user",
};
const EDITOR: AdminIdentity = { ...ADMIN, id: "u_2", role: "editor" };

const EMAIL = "bat@example.mn";
const PDF = Buffer.from("%PDF-1.7 fake").toString("base64");

type Params = { key: string; kind: string };

/** The route, called the way Next calls it. */
function get(params: Params, query = "") {
  const url = `https://career.shunkhlai.mn/admin/applications/${params.key}/file/${params.kind}${query}`;
  return GET(new Request(url), {
    params: Promise.resolve(params),
  } as unknown as Parameters<typeof GET>[1]);
}

beforeEach(() => {
  memory.user = ADMIN;
  memory.resolved = { email: EMAIL, entryid: 1_000_000_001 };
  memory.cv = { filename: "Бат_Дорж_CV.pdf", data: PDF };
  memory.picture = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64")}`;
  memory.read = [];
  memory.throws = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* --- the gate ------------------------------------------------------------- */

describe("who gets in", () => {
  it("sends a visitor with no admin session to the login page", async () => {
    memory.user = null;
    await expect(get({ key: "known-key", kind: "cv" })).rejects.toThrow("REDIRECT /admin/login");
    expect(memory.read).toEqual([]);
  });

  it("refuses an editor, and does not open the file to find out", async () => {
    memory.user = EDITOR;
    const response = await get({ key: "known-key", kind: "cv" });

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("эрх байхгүй");
    // The refusal is decided before the account behind the key is even resolved.
    expect(memory.read).toEqual([]);
  });

  it("serves an admin the CV of the account the key resolves to", async () => {
    const response = await get({ key: "known-key", kind: "cv" });
    expect(response.status).toBe(200);
    expect(memory.read).toEqual([`cv:${EMAIL}`]);
  });
});

/* --- the addressing ------------------------------------------------------- */

describe("the address", () => {
  it("404s a key no application has, without naming an account", async () => {
    const response = await get({ key: "made-up", kind: "cv" });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(EMAIL);
  });

  it("404s a kind that is not a file this route serves", async () => {
    const response = await get({ key: "known-key", kind: "passport" });
    expect(response.status).toBe(404);
    expect(memory.read).toEqual([]);
  });
});

/* --- the bytes ------------------------------------------------------------ */

describe("what comes back", () => {
  it("downloads the CV by default, with its exact name and no shared caching", async () => {
    const response = await get({ key: "known-key", kind: "cv" });

    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename=/u);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer()).toString("base64")).toBe(PDF);
  });

  it("shows a PDF in the browser when the page asked it to", async () => {
    const response = await get({ key: "known-key", kind: "cv" }, "?view=1");
    expect(response.headers.get("content-disposition")).toMatch(/^inline; filename=/u);
  });

  it("downloads a Word CV even when asked to show it", async () => {
    memory.cv = { filename: "cv.docx", data: PDF };
    const response = await get({ key: "known-key", kind: "cv" }, "?view=1");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename=/u);
  });

  it("serves the photo inline, with the type the store recorded", async () => {
    const response = await get({ key: "known-key", kind: "photo" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(memory.read).toEqual([`picture:${EMAIL}`]);
  });

  it("404s a CV the applicant never attached", async () => {
    memory.cv = null;
    const response = await get({ key: "known-key", kind: "cv" });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("CV хавсаргаагүй байна.");
  });

  it("404s a photo that is not there", async () => {
    memory.picture = null;
    const response = await get({ key: "known-key", kind: "photo" });
    expect(response.status).toBe(404);
  });

  it("answers 500 in Mongolian when the file store falls over", async () => {
    memory.throws = true;
    const response = await get({ key: "known-key", kind: "cv" });
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("Дараа дахин оролдоно уу.");
  });
});
