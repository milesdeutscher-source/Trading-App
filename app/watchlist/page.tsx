import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Watchlist from "@/components/Watchlist";

export const metadata = {
  title: "Watchlist · Trading App",
  description: "Live BTC, ETH and SOL prices against USDT.",
};

export default function WatchlistPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">
          <h2 className="text-base font-medium">Watchlist</h2>
          <p className="mt-2 mb-6 text-sm text-white/60">
            Live prices from Binance, refreshed every 10 seconds.
          </p>
          <Watchlist />
        </main>
      </div>
    </div>
  );
}
