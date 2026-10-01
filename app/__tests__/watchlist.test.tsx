import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WatchlistPage from "@/app/watchlist/page";

vi.mock("@/components/Watchlist", () => ({
  default: () => <div data-testid="watchlist" />,
}));

describe("Watchlist page", () => {
  it("renders the shell and the watchlist", () => {
    render(<WatchlistPage />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Watchlist" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("watchlist")).toBeInTheDocument();
  });
});
