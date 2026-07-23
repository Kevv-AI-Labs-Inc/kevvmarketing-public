import { beforeEach, describe, expect, it, vi } from "vitest";

const axiosMocks = vi.hoisted(() => {
  const get = vi.fn();
  const post = vi.fn();
  const use = vi.fn();
  const client = {
    get,
    post,
    interceptors: { response: { use } },
  };
  const create = vi.fn(() => client);
  return { get, post, use, client, create };
});

vi.mock("axios", () => ({
  default: { create: axiosMocks.create },
}));

describe("listingDataClient BBO contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LISTING_DATA_SERVICE_URL", "https://bbo.example.test");
    vi.stubEnv("LISTING_DATA_SERVICE_API_KEY", "test-key");
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
    axiosMocks.use.mockReset();
    axiosMocks.create.mockReset().mockReturnValue(axiosMocks.client);
  });

  it("uses GET query params for listing search", async () => {
    axiosMocks.get.mockResolvedValueOnce({
      data: {
        items: [{ listingKey: "KEY1", listPrice: 850000 }],
        totalCount: 42,
        hasMore: true,
        limit: 10,
        offset: 10,
      },
    });
    const { searchListings } = await import(
      "@/server/clients/listingDataClient"
    );

    const result = await searchListings({
      search: "Flushing",
      minPrice: 500000,
      maxPrice: 1000000,
      page: 2,
      perPage: 10,
    });

    expect(axiosMocks.get).toHaveBeenCalledWith(
      "/api/v1/listings/search",
      {
        params: expect.objectContaining({
          q: "Flushing",
          priceMin: 500000,
          priceMax: 1000000,
          limit: 10,
          offset: 10,
        }),
      },
    );
    expect(axiosMocks.post).not.toHaveBeenCalled();
    expect(result.meta).toEqual({
      total: 42,
      page: 2,
      perPage: 10,
      totalPages: 5,
    });
    expect(result.nextCursor).toBe("20");
  });

  it("uses the BBO batch request and response fields", async () => {
    axiosMocks.post.mockResolvedValueOnce({
      data: {
        results: [
          {
            property: {
              listingKey: "KEY1",
              listingId: "MLS1",
              unparsedAddress: "1 Main St",
            },
            media: [{ mediaKey: "M1" }],
            imageUrls: ["https://cdn.example.test/1.jpg"],
          },
        ],
      },
    });
    const { getListingsBatch } = await import(
      "@/server/clients/listingDataClient"
    );

    const result = await getListingsBatch(["KEY1"]);

    expect(axiosMocks.post).toHaveBeenCalledWith(
      "/api/v1/listings/batch",
      { keys: ["KEY1"] },
    );
    expect(result.get("KEY1")?.data.listingId).toBe("MLS1");
    expect(result.get("KEY1")?.imageUrls).toEqual([
      "https://cdn.example.test/1.jpg",
    ]);
  });

  it("uses GET with one combined address for address endpoints", async () => {
    axiosMocks.get
      .mockResolvedValueOnce({
        data: {
          source: "local",
          fallbackUsed: false,
          property: { listingKey: "KEY1" },
          media: [],
          imageUrls: [],
          imageCount: 0,
        },
      })
      .mockResolvedValueOnce({
        data: {
          candidates: [
            {
              listingKey: "KEY1",
              listingId: "MLS1",
              unparsedAddress: "1 Main St",
              city: "Flushing",
              stateOrProvince: "NY",
              postalCode: "11358",
              standardStatus: "Active",
            },
          ],
        },
      });
    const { getAddressCandidates, resolveByAddress } = await import(
      "@/server/clients/listingDataClient"
    );
    const input = {
      address: "1 Main St",
      city: "Flushing",
      stateOrProvince: "NY",
      postalCode: "11358",
    };

    await resolveByAddress(input);
    const candidates = await getAddressCandidates(input);

    const config = {
      params: { address: "1 Main St, Flushing, NY, 11358" },
    };
    expect(axiosMocks.get).toHaveBeenNthCalledWith(
      1,
      "/api/v1/listings/by-address",
      config,
    );
    expect(axiosMocks.get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/listings/address-candidates",
      config,
    );
    expect(candidates.data[0]?.listingKey).toBe("KEY1");
  });
});
