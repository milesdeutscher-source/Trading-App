# Trading App

A trading dashboard built with Next.js (App Router), TypeScript and Tailwind CSS.

The home page renders a placeholder dashboard layout (header, sidebar, main
area). The Watchlist view is live; the Chart and Portfolio views are not
implemented yet — those sidebar links point at routes that will be added in
later work.

## Watchlist

`/watchlist` shows live prices for BTC/USDT, ETH/USDT and SOL/USDT: last price,
24h change (green when up, red when down) and 24h volume in USDT. Prices refresh
every 10 seconds.

Data comes from Binance's public REST API (`/api/v3/ticker/24hr`), which needs no
API key. Every call to Binance goes through `lib/marketData.ts`; its tests mock
`fetch`, so `npm test` never touches the network.

## Requirements

- Node.js 20 or newer
- npm

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The app is served at [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test
```

Unit tests run with [Vitest](https://vitest.dev/) in a jsdom environment, using
React Testing Library. Use `npm run test:watch` while developing.

## Lint

```bash
npm run lint
```

## Build

```bash
npm run build
npm start   # serve the production build
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Build for production |
| `npm start` | Serve the production build |
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Run the unit tests in watch mode |
| `npm run lint` | Lint with ESLint |

## Project layout

```
app/                 App Router routes, root layout and global styles
  page.tsx           Dashboard home page
  layout.tsx         Root layout
  globals.css        Tailwind entry point
  watchlist/page.tsx Watchlist route
  __tests__/         Page tests
components/          Shared UI components
  Header.tsx         Top bar with the app name
  Sidebar.tsx        Navigation: Watchlist / Chart / Portfolio
  Watchlist.tsx      Live price table, polls every 10 seconds
  __tests__/         Component tests
lib/                 Data access
  marketData.ts      Binance REST API client, typed
  __tests__/         Data module tests (fetch mocked)
.github/workflows/   CI: lint, test and build on every push and pull request
```

## CI

GitHub Actions runs `npm run lint`, `npm test` and `npm run build` on every push
and pull request. See `.github/workflows/ci.yml`.
