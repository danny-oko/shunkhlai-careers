import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The save action uploads a cover before it writes the article, because the
 * article needs the new key. If the write then fails, the upload has to be
 * taken back — otherwise every failed save with a picture leaves chunks in
 * `news_media` that no story will ever point at. The store is mocked: this is
 * about the action's order of operations, and nothing here may reach D1.
 */

const store = vi.hoisted(() => ({
  getArticleById: vi.fn(),
  listArticles: vi.fn(),
  putMedia: vi.fn(),
  saveArticle: vi.fn(),
  deleteArticle: vi.fn(),
  dropMedia: vi.fn(),
}));

vi.mock("@/server/news/store", () => store);
/** Who the action thinks is signed in. Flipped per case by the role tests. */
const signedIn = vi.hoisted(() => ({
  role: "admin",
}));

vi.mock("@/server/admin/guard", () => ({
  requireAdmin: vi.fn(async () => undefined),
  requireAdminUser: vi.fn(async () => ({
    id: "usr_test",
    name: "Б. Энхжаргал",
    email: "admin@shunkhlai.mn",
    role: signedIn.role,
    source: "app_user" as const,
  })),
  // The real rule, not a stub of it: the point of these tests is that the
  // action asks it and obeys the answer.
  mayDeleteArticles: (user: { role: string }) => user.role === "admin",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

const { deleteArticleAction, saveArticleAction } = await import("./actions");

function form(fields: Record<string, string>, cover?: File): FormData {
  const data = new FormData();
  const base = {
    title: "Гарчиг",
    lede: "Тэргүүн үг.",
    category: "company",
    author: "Б. Б",
    publishedAt: "2026-09-01",
    coverAlt: "",
    body: "Бичвэр.",
    status: "published",
  };
  for (const [key, value] of Object.entries({ ...base, ...fields })) data.set(key, value);
  if (cover) data.set("cover", cover);
  return data;
}

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "a.png", { type: "image/png" });

beforeEach(() => {
  for (const fn of Object.values(store)) fn.mockReset();
  store.listArticles.mockResolvedValue([]);
  store.putMedia.mockResolvedValue("med_aaaabbbbcccc");
  store.dropMedia.mockResolvedValue(undefined);
});

describe("saveArticleAction — a failed save takes its upload back", () => {
  it("drops the new media key when the article write fails", async () => {
    store.saveArticle.mockRejectedValue(new Error("D1 down"));

    const state = await saveArticleAction({}, form({}, png()));

    expect(state.message).toBeTruthy();
    expect(store.putMedia).toHaveBeenCalledOnce();
    expect(store.dropMedia).toHaveBeenCalledWith("med_aaaabbbbcccc");
  });

  it("drops it too when demoting the old lead fails", async () => {
    store.listArticles.mockRejectedValue(new Error("D1 down"));

    await saveArticleAction({}, form({ featured: "on" }, png()));

    expect(store.dropMedia).toHaveBeenCalledWith("med_aaaabbbbcccc");
    expect(store.saveArticle).not.toHaveBeenCalled();
  });

  it("still reports the save failure when the clean-up fails as well", async () => {
    store.saveArticle.mockRejectedValue(new Error("D1 down"));
    store.dropMedia.mockRejectedValue(new Error("still down"));

    const state = await saveArticleAction({}, form({}, png()));

    expect(state.message).toBeTruthy();
    expect(state.values?.title).toBe("Гарчиг");
  });

  it("drops nothing when no file was uploaded", async () => {
    store.saveArticle.mockRejectedValue(new Error("D1 down"));

    await saveArticleAction({}, form({ coverUrl: "https://res.cloudinary.com/x/a.jpg" }));

    expect(store.dropMedia).not.toHaveBeenCalled();
  });

  it("keeps the upload when the save succeeds", async () => {
    store.saveArticle.mockResolvedValue({ slug: "garchig" });

    await expect(saveArticleAction({}, form({}, png()))).rejects.toThrow(
      "NEXT_REDIRECT /admin/news?saved=garchig",
    );
    expect(store.dropMedia).not.toHaveBeenCalled();
  });
});

describe("deleteArticleAction — who may destroy a story", () => {
  beforeEach(() => {
    signedIn.role = "admin";
    store.getArticleById.mockResolvedValue({ id: "art_1", slug: "surgalt", title: "Гарчиг" });
    store.deleteArticle.mockResolvedValue(true);
  });

  it("lets an admin delete", async () => {
    const data = new FormData();
    data.append("id", "art_1");

    await expect(deleteArticleAction(data)).rejects.toThrow("NEXT_REDIRECT /admin/news?deleted=1");
    expect(store.deleteArticle).toHaveBeenCalledWith("art_1");
  });

  it("refuses an editor, and does not reach the store at all", async () => {
    signedIn.role = "editor";
    const data = new FormData();
    data.append("id", "art_1");

    // An editor may write and rewrite; deleting is the one irreversible
    // control, so it is checked here rather than only hidden in the UI — a
    // POST does not come through the UI.
    await expect(deleteArticleAction(data)).rejects.toThrow(
      "NEXT_REDIRECT /admin/news?error=forbidden",
    );
    expect(store.deleteArticle).not.toHaveBeenCalled();
    expect(store.getArticleById).not.toHaveBeenCalled();
  });

  it("refuses any role that is not admin", async () => {
    for (const role of ["viewer", "", "ADMIN", "admin "]) {
      signedIn.role = role;
      store.deleteArticle.mockClear();
      const data = new FormData();
      data.append("id", "art_1");

      await expect(deleteArticleAction(data), role).rejects.toThrow("error=forbidden");
      expect(store.deleteArticle, role).not.toHaveBeenCalled();
    }
  });
});
