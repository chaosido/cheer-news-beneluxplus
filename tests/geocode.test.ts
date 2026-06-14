import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocode, __clearGeocodeCache } from "@/lib/geocode";

/** Build a Response-like object for the mocked fetch. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("geocode", () => {
  beforeEach(() => {
    __clearGeocodeCache();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null for an empty query without hitting the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("")).toBeNull();
    expect(await geocode("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a valid lat/lon string response into numbers", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ lat: "52.3702", lon: "4.8952" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("Amsterdam")).toEqual({ lat: 52.3702, lng: 4.8952 });
  });

  it("caches results: a repeated query invokes fetch only once", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ lat: "51.4416", lon: "5.4697" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await geocode("Eindhoven");
    const second = await geocode("Eindhoven");

    expect(first).toEqual({ lat: 51.4416, lng: 5.4697 });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes the query for cache hits (case/whitespace insensitive)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ lat: "52.0907", lon: "5.1214" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    await geocode("Utrecht");
    await geocode("  utrecht  ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null on a non-ok HTTP response", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(null, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("Nowhere 404")).toBeNull();
  });

  it("returns null when the JSON body is malformed (not an array)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "boom" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("Malformed object")).toBeNull();
  });

  it("returns null when JSON parsing throws", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("Unexpected token");
          },
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("Broken JSON")).toBeNull();
  });

  it("returns null for an empty array result", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("Empty result")).toBeNull();
  });

  it("returns null when lat/lon are missing or non-string", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ lat: 52.37, lon: 4.89 }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("Numeric coords")).toBeNull();
  });

  it("returns null when lat/lon are non-finite", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ lat: "not-a-number", lon: "4.89" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("NaN coords")).toBeNull();
  });

  it("caches a null result so failed lookups are not retried", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await geocode("Cached miss");
    await geocode("Cached miss");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
