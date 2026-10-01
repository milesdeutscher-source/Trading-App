import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Binance24hrTicker,
  fetchTickers,
  MarketDataError,
  WATCHLIST_SYMBOLS,
} from "@/lib/marketData";

/**
 * Every test here mocks `fetch`, so the suite never touches the network.
 */

function rawTicker(
  overrides: Partial<Binance24hrTicker> & Pick<Binance24hrTicker, "symbol">,
): Binance24hrTicker {
  return {
    lastPrice: "100.00",
    priceChangePercent: "1.00",
    volume: "10.0",
    quoteVolume: "1000.0",
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  } as unknown as Response;
}

function errorResponse(status: number, statusText = ""): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({ code: -1121, msg: "Invalid symbol." }),
  } as unknown as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("fetchTickers", () => {
  it("parses Binance's string numbers into a typed ticker", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        rawTicker({
          symbol: "BTCUSDT",
          lastPrice: "64250.12",
          priceChangePercent: "2.35",
          volume: "12345.678",
          quoteVolume: "987654321.5",
        }),
      ]),
    );

    const tickers = await fetchTickers(["BTCUSDT"]);

    expect(tickers).toEqual([
      {
        symbol: "BTCUSDT",
        lastPrice: 64250.12,
        priceChangePercent: 2.35,
        volume: 12345.678,
        quoteVolume: 987654321.5,
      },
    ]);
  });

  it("keeps negative 24h changes negative", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        rawTicker({ symbol: "SOLUSDT", priceChangePercent: "-4.20" }),
      ]),
    );

    const [sol] = await fetchTickers(["SOLUSDT"]);

    expect(sol.priceChangePercent).toBe(-4.2);
  });

  it("asks Binance for the watchlist pairs by default", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(WATCHLIST_SYMBOLS.map((symbol) => rawTicker({ symbol }))),
    );

    await fetchTickers();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22%2C%22ETHUSDT%22%2C%22SOLUSDT%22%5D",
    );
  });

  it("returns pairs in the order they were requested", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        rawTicker({ symbol: "SOLUSDT" }),
        rawTicker({ symbol: "BTCUSDT" }),
        rawTicker({ symbol: "ETHUSDT" }),
      ]),
    );

    const tickers = await fetchTickers(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);

    expect(tickers.map((ticker) => ticker.symbol)).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
    ]);
  });

  it("passes an abort signal through to fetch", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([rawTicker({ symbol: "BTCUSDT" })]),
    );
    const controller = new AbortController();

    await fetchTickers(["BTCUSDT"], { signal: controller.signal });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: controller.signal,
    });
  });

  it("does not call Binance when no symbols are asked for", async () => {
    await expect(fetchTickers([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with a MarketDataError when the request cannot be made", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchTickers(["BTCUSDT"])).rejects.toThrow(MarketDataError);
    await expect(fetchTickers(["BTCUSDT"])).rejects.toThrow(
      "Could not reach Binance.",
    );
  });

  it("reports the HTTP status when Binance answers with an error", async () => {
    fetchMock.mockResolvedValue(errorResponse(429, "Too Many Requests"));

    await expect(fetchTickers(["BTCUSDT"])).rejects.toMatchObject({
      name: "MarketDataError",
      message: "Binance answered with 429 Too Many Requests.",
      status: 429,
    });
  });

  it("reports a bare status when Binance sends no status text", async () => {
    fetchMock.mockResolvedValue(errorResponse(500));

    await expect(fetchTickers(["BTCUSDT"])).rejects.toThrow(
      "Binance answered with 500.",
    );
  });

  it("fails when the body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    } as unknown as Response);

    await expect(fetchTickers(["BTCUSDT"])).rejects.toThrow(
      "Binance sent a response that is not JSON.",
    );
  });

  it("fails when the payload is not a list of tickers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: -1121 }));

    await expect(fetchTickers(["BTCUSDT"])).rejects.toThrow(
      "Binance sent an unexpected payload.",
    );
  });

  it("fails when a ticker is missing fields", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ symbol: "BTCUSDT", lastPrice: "100.00" }]),
    );

    await expect(fetchTickers(["BTCUSDT"])).rejects.toThrow(
      "Binance sent an unexpected payload.",
    );
  });

  it("fails when a requested pair is missing from the response", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([rawTicker({ symbol: "BTCUSDT" })]),
    );

    await expect(fetchTickers(["BTCUSDT", "ETHUSDT"])).rejects.toThrow(
      "Binance sent no data for ETHUSDT.",
    );
  });

  it("fails when a number cannot be read", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([rawTicker({ symbol: "BTCUSDT", lastPrice: "n/a" })]),
    );

    await expect(fetchTickers(["BTCUSDT"])).rejects.toThrow(
      "Binance sent an unreadable price for BTCUSDT.",
    );
  });
});

describe("WATCHLIST_SYMBOLS", () => {
  it("is BTC, ETH and SOL against USDT", () => {
    expect(WATCHLIST_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
  });
});
