"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchTickers,
  MarketTicker,
  WATCHLIST_SYMBOLS,
} from "@/lib/marketData";

/** How often prices are refreshed. */
export const REFRESH_INTERVAL_MS = 10_000;

const QUOTE_ASSET = "USDT";

/** `BTCUSDT` reads as `BTC/USDT`. */
export function formatPair(symbol: string): string {
  return symbol.endsWith(QUOTE_ASSET)
    ? `${symbol.slice(0, -QUOTE_ASSET.length)}/${QUOTE_ASSET}`
    : symbol;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: price >= 1 ? 2 : 6,
  });
}

export function formatChangePercent(percent: number): string {
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

export function formatVolume(volume: number): string {
  return volume.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

export default function Watchlist() {
  const [tickers, setTickers] = useState<MarketTicker[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const renderRow = useCallback((ticker: MarketTicker) => {
    const isUp = ticker.priceChangePercent >= 0;
    return (
      <tr key={ticker.symbol} className="border-b border-white/5">
        <th scope="row" className="px-4 py-3 text-left font-medium">
          {formatPair(ticker.symbol)}
        </th>
        <td className="px-4 py-3 text-right tabular-nums">
          {formatPrice(ticker.lastPrice)}
        </td>
        <td
          className={`px-4 py-3 text-right tabular-nums ${
            isUp ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {formatChangePercent(ticker.priceChangePercent)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-white/70">
          {formatVolume(ticker.quoteVolume)}
        </td>
      </tr>
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        const next = await fetchTickers(WATCHLIST_SYMBOLS, {
          signal: controller.signal,
        });
        if (cancelled) {
          return;
        }
        setTickers(next);
        setUpdatedAt(new Date());
        setError(null);
      } catch (caught) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load prices from Binance.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  if (isLoading && !tickers) {
    return (
      <p role="status" className="text-sm text-white/60">
        Loading prices…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          Could not load live prices: {error}
          {tickers && " Showing the last prices received."}
        </p>
      )}

      {tickers && (
        <>
          <table className="w-full max-w-2xl border-collapse text-sm">
            <caption className="sr-only">
              Live prices for {WATCHLIST_SYMBOLS.map(formatPair).join(", ")}
            </caption>
            <thead>
              <tr className="border-b border-white/10 text-white/50">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Symbol
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Last price
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  24h change
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  24h volume ({QUOTE_ASSET})
                </th>
              </tr>
            </thead>
            <tbody>{tickers.map(renderRow)}</tbody>
          </table>

          {updatedAt && (
            <p className="text-xs text-white/40">
              Updated {updatedAt.toLocaleTimeString("en-US")} · refreshes every{" "}
              {REFRESH_INTERVAL_MS / 1000} seconds
            </p>
          )}
        </>
      )}
    </div>
  );
}
