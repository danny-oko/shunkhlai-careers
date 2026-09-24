import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the service promises about the recruitment API: a successful read is
 * shared between visitors, a failed one is never remembered, and two spellings
 * of the same query are one read.
 *
 * `unstable_cache` needs a running Next server, so it is replaced with a
 * stand-in that keeps the one property these tests are about — it stores what
 * the function returned and nothing when it threw.
 */

const api = vi.hoisted(() => ({
  listOrders: vi.fn(),
  getOrder: vi.fn(),
  filterData: vi.fn(),
}));
const config = vi.hoisted(() => ({ live: true }));

vi.mock("next/cache", () => ({
  unstable_cache: <Args extends unknown[], Result>(
    fn: (...args: Args) => Promise<Result>,
    keyParts: string[],
  ) => {
    const stored = new Map<string, Result>();
    return async (...args: Args) => {
      const key = `${keyParts.join(":")}|${JSON.stringify(args)}`;
      if (stored.has(key)) return stored.get(key) as Result;
      const value = await fn(...args);
      stored.set(key, value);
      return value;
    };
  },
}));
vi.mock("@/lib/api/jobs", () => api);
vi.mock("@/lib/api/core/config", () => ({ hasLiveBackend: () => config.live }));
vi.mock("./local", () => ({
  listOrders: async () => [],
  getOrder: async () => {
    throw new Error("missing");
  },
  filterData: async () => null,
}));

const row = {
  entryid: 786,
  posname: "Багаж хариуцсан ажилтан",
  locname: "Төв оффис",
  companyname: "Barloworld Mongolia",
  companyid: "BARLO",
  postypeid: 2006,
  postype: "Үндсэн",
  posgroupid: 142,
  posgroupname: "Инженер, Техник",
  worktype: "Бүтэн цагийн",
  requestdate: "2026.08.20",
  advbegindate: "2026.09.01",
  advenddate: null,
  status: 5,
  statusname: "Анкет хүлээн авах",
  remainingdays: null,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  config.live = true;
});

describe("listJobs with a live backend", () => {
  it("shares one read between visitors", async () => {
    api.listOrders.mockResolvedValue([row]);
    const { listJobs: fresh } = await import("./service");

    await fresh({ jobName: "багаж" });
    await fresh({ jobName: "багаж" });

    expect(api.listOrders).toHaveBeenCalledTimes(1);
  });

  it("treats an empty query and the same query spelled out as one read", async () => {
    api.listOrders.mockResolvedValue([row]);
    const { listJobs: fresh } = await import("./service");

    await fresh();
    await fresh({ jobName: "", locationid: 0, salaryLevelID: "" });

    expect(api.listOrders).toHaveBeenCalledTimes(1);
  });

  it("keeps different queries apart", async () => {
    api.listOrders.mockResolvedValue([row]);
    const { listJobs: fresh } = await import("./service");

    await fresh({ locationid: 1 });
    await fresh({ locationid: 2 });

    expect(api.listOrders).toHaveBeenCalledTimes(2);
  });

  it("does not remember an outage", async () => {
    api.listOrders.mockRejectedValueOnce(new Error("ERP down")).mockResolvedValue([row]);
    const { listJobs: fresh } = await import("./service");

    await expect(fresh()).rejects.toThrow("ERP down");
    await expect(fresh()).resolves.toHaveLength(1);

    expect(api.listOrders).toHaveBeenCalledTimes(2);
  });
});

describe("getFilterData", () => {
  it("answers null on an outage and recovers on the next call", async () => {
    api.filterData.mockRejectedValueOnce(new Error("ERP down")).mockResolvedValue({ location: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getFilterData: fresh } = await import("./service");

    expect(await fresh()).toBeNull();
    expect(await fresh()).toEqual({ location: [] });
  });
});

describe("getJob", () => {
  it("answers null for a posting the backend cannot find", async () => {
    api.getOrder.mockRejectedValue(new Error("not found"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getJob: fresh } = await import("./service");

    expect(await fresh("786-багаж")).toBeNull();
  });
});

describe("without a live backend", () => {
  it("reads the in-process mock and never touches the cached client", async () => {
    config.live = false;
    const { listJobs: fresh } = await import("./service");

    expect(await fresh()).toEqual([]);
    expect(api.listOrders).not.toHaveBeenCalled();
  });
});
