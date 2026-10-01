import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Watchlist, {
  formatChangePercent,
  formatPair,
  formatPrice,
  REFRESH_INTERVAL_MS,
} from "@/components/Watchlist";
import { fetchTickers, MarketDataError, MarketTicker } from "@/lib/marketData";

vi.mock("@/lib/marketData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketData")>();
  return { ...actual, fetchTickers: vi.fn() };
});

const fetchTickersMock = vi.mocked(fetchTickers);

/** Advances fake timers and lets React flush the state updates that follow. */
async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function ticker(overrides: Partial<MarketTicker> = {}): MarketTicker {
  return {
    symbol: "BTCUSDT",
    lastPrice: 64250.12,
    priceChangePercent: 2.35,
    volume: 12345.678,
    quoteVolume: 987654321.5,
    ...overrides,
  };
}

const threePairs: MarketTicker[] = [
  ticker(),
  ticker({ symbol: "ETHUSDT", lastPrice: 3120.5, priceChangePercent: -1.4 }),
  ticker({ symbol: "SOLUSDT", lastPrice: 148.27, priceChangePercent: 0 }),
];

afterEach(() => {
  fetchTickersMock.mockReset();
});

describe("Watchlist", () => {
  it("shows a loading state until the first prices arrive", async () => {
    let resolve: (value: MarketTicker[]) => void = () => {};
    fetchTickersMock.mockReturnValue(
      new Promise<MarketTicker[]>((r) => {
        resolve = r;
      }),
    );

    render(<Watchlist />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading prices…");

    await act(async () => {
      resolve(threePairs);
    });

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("renders a row per pair with price, change and volume", async () => {
    fetchTickersMock.mockResolvedValue(threePairs);

    render(<Watchlist />);

    const btc = await screen.findByRole("row", { name: /BTC\/USDT/ });
    expect(btc).toHaveTextContent("64,250.12");
    expect(btc).toHaveTextContent("+2.35%");

    expect(
      await screen.findByRole("row", { name: /ETH\/USDT/ }),
    ).toHaveTextContent("3,120.50");
    expect(
      await screen.findByRole("row", { name: /SOL\/USDT/ }),
    ).toHaveTextContent("148.27");
  });

  it("colours gains green and losses red", async () => {
    fetchTickersMock.mockResolvedValue(threePairs);

    render(<Watchlist />);

    expect(await screen.findByText("+2.35%")).toHaveClass("text-emerald-400");
    expect(screen.getByText("-1.40%")).toHaveClass("text-rose-400");
    expect(screen.getByText("0.00%")).toHaveClass("text-emerald-400");
  });

  it("shows an error message when Binance fails", async () => {
    fetchTickersMock.mockRejectedValue(
      new MarketDataError("Binance answered with 500.", { status: 500 }),
    );

    render(<Watchlist />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not load live prices: Binance answered with 500.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the last prices on screen when a refresh fails", async () => {
    fetchTickersMock
      .mockResolvedValueOnce(threePairs)
      .mockRejectedValueOnce(new MarketDataError("Could not reach Binance."));
    vi.useFakeTimers();

    try {
      render(<Watchlist />);
      await tick(0);
      expect(screen.getByRole("table")).toBeInTheDocument();

      await tick(REFRESH_INTERVAL_MS);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Showing the last prices received.",
      );
      expect(screen.getByRole("table")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes every 10 seconds", async () => {
    fetchTickersMock.mockResolvedValue(threePairs);
    vi.useFakeTimers();

    try {
      render(<Watchlist />);
      await tick(0);
      expect(fetchTickersMock).toHaveBeenCalledTimes(1);

      await tick(REFRESH_INTERVAL_MS);
      expect(fetchTickersMock).toHaveBeenCalledTimes(2);

      await tick(REFRESH_INTERVAL_MS);
      expect(fetchTickersMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops refreshing once unmounted", async () => {
    fetchTickersMock.mockResolvedValue(threePairs);
    vi.useFakeTimers();

    try {
      const { unmount } = render(<Watchlist />);
      await tick(0);
      unmount();

      await tick(REFRESH_INTERVAL_MS * 3);

      expect(fetchTickersMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes on a 10 second interval", () => {
    expect(REFRESH_INTERVAL_MS).toBe(10_000);
  });
});

describe("formatters", () => {
  it("reads a pair as base over quote", () => {
    expect(formatPair("BTCUSDT")).toBe("BTC/USDT");
    expect(formatPair("BTCEUR")).toBe("BTCEUR");
  });

  it("keeps two decimals above one and more below", () => {
    expect(formatPrice(64250.1)).toBe("64,250.10");
    expect(formatPrice(0.00012345)).toBe("0.000123");
  });

  it("signs the 24h change", () => {
    expect(formatChangePercent(2.3)).toBe("+2.30%");
    expect(formatChangePercent(-2.3)).toBe("-2.30%");
    expect(formatChangePercent(0)).toBe("0.00%");
  });
});
