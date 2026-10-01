/**
 * Market data from Binance's public REST API.
 *
 * Every network call the app makes to Binance lives in this module. The public
 * endpoints used here need no API key and no authentication.
 */

const BINANCE_API_BASE = "https://api.binance.com";
const TICKER_24HR_PATH = "/api/v3/ticker/24hr";

/** Pairs shown on the watchlist, in display order. */
export const WATCHLIST_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;

export type WatchlistSymbol = (typeof WATCHLIST_SYMBOLS)[number];

/**
 * The fields of Binance's `/api/v3/ticker/24hr` payload that the watchlist
 * uses. Binance sends every number as a string.
 */
export interface Binance24hrTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
}

/** A ticker with its numbers parsed, ready to render. */
export interface MarketTicker {
  /** Pair name, e.g. `BTCUSDT`. */
  symbol: string;
  /** Last traded price, in the quote asset. */
  lastPrice: number;
  /** Price change over the last 24h, in percent (negative when down). */
  priceChangePercent: number;
  /** Volume over the last 24h, in the base asset. */
  volume: number;
  /** Volume over the last 24h, in the quote asset. */
  quoteVolume: number;
}

export interface MarketDataErrorOptions extends ErrorOptions {
  /** HTTP status, when Binance answered with a non-2xx response. */
  status?: number;
}

/** Any failure while loading market data: network, HTTP or payload shape. */
export class MarketDataError extends Error {
  readonly status?: number;

  constructor(message: string, options: MarketDataErrorOptions = {}) {
    super(message, options);
    this.name = "MarketDataError";
    this.status = options.status;
  }
}

export interface FetchTickersOptions {
  /** Aborts the request, e.g. when the caller unmounts. */
  signal?: AbortSignal;
}

function isBinance24hrTicker(value: unknown): value is Binance24hrTicker {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.symbol === "string" &&
    typeof candidate.lastPrice === "string" &&
    typeof candidate.priceChangePercent === "string" &&
    typeof candidate.volume === "string" &&
    typeof candidate.quoteVolume === "string"
  );
}

function toNumber(raw: string, field: string, symbol: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new MarketDataError(
      `Binance sent an unreadable ${field} for ${symbol}.`,
    );
  }
  return parsed;
}

function toMarketTicker(raw: Binance24hrTicker): MarketTicker {
  return {
    symbol: raw.symbol,
    lastPrice: toNumber(raw.lastPrice, "price", raw.symbol),
    priceChangePercent: toNumber(
      raw.priceChangePercent,
      "24h change",
      raw.symbol,
    ),
    volume: toNumber(raw.volume, "24h volume", raw.symbol),
    quoteVolume: toNumber(raw.quoteVolume, "24h quote volume", raw.symbol),
  };
}

function tickerUrl(symbols: readonly string[]): string {
  const query = encodeURIComponent(JSON.stringify([...symbols]));
  return `${BINANCE_API_BASE}${TICKER_24HR_PATH}?symbols=${query}`;
}

/**
 * Reads 24h ticker data for the given pairs.
 *
 * Results come back in the order the symbols were asked for, not the order
 * Binance happens to answer in.
 *
 * @throws {MarketDataError} when the request fails, Binance answers with a
 * non-2xx status, or the payload is not shaped as expected.
 */
export async function fetchTickers(
  symbols: readonly string[] = WATCHLIST_SYMBOLS,
  options: FetchTickersOptions = {},
): Promise<MarketTicker[]> {
  if (symbols.length === 0) {
    return [];
  }

  let response: Response;
  try {
    response = await fetch(tickerUrl(symbols), {
      signal: options.signal,
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    throw new MarketDataError("Could not reach Binance.", { cause });
  }

  if (!response.ok) {
    const detail = response.statusText
      ? `${response.status} ${response.statusText}`
      : `${response.status}`;
    throw new MarketDataError(`Binance answered with ${detail}.`, {
      status: response.status,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new MarketDataError("Binance sent a response that is not JSON.", {
      cause,
    });
  }

  if (!Array.isArray(payload) || !payload.every(isBinance24hrTicker)) {
    throw new MarketDataError("Binance sent an unexpected payload.");
  }

  const bySymbol = new Map(payload.map((ticker) => [ticker.symbol, ticker]));

  return symbols.map((symbol) => {
    const raw = bySymbol.get(symbol);
    if (!raw) {
      throw new MarketDataError(`Binance sent no data for ${symbol}.`);
    }
    return toMarketTicker(raw);
  });
}
