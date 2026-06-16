# 🏓 Pickleball Mixer

A browser-based **doubles round-robin generator** for pickleball (and any 4-player doubles sport). Enter your roster, pick the number of courts and rounds, and the app builds a balanced schedule that **minimizes repeat partners and repeat opponents** — so everyone plays with and against as many different people as possible.

Track scores round by round, crown a champion with an optional finals round, save sessions in your browser, and share a full session with a single link.

## Features

- **Smart schedule generation** — minimizes repeat partnerships and repeat matchups. Uses an _exact_ search for 1–2 courts and a fast heuristic for larger setups.
- **Fair sit-outs** — when you have more players than court slots, the app rotates who sits out so it stays even.
- **Live scoring & standings** — enter points per game; cumulative standings update automatically, with ties handled correctly.
- **Championship round** — optionally build a finals round seeded from the current standings.
- **Save sessions** — store rosters and in-progress sessions in your browser's local storage.
- **Share by link** — encode an entire session (roster, schedule, and scores) into a shareable URL or payload, and import it back on another device.

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) for dev server and builds
- No backend — everything runs client-side; data persists via `localStorage`

## Getting started

Requires [Node.js](https://nodejs.org/) 18+ (CI builds with Node 22).

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview
```

The dev server prints a local URL (typically `http://localhost:5173`).

## Development

| Command                | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the Vite dev server with hot reload.     |
| `npm run build`        | Type-check (`tsc`) and build for production.   |
| `npm run preview`      | Serve the production build locally.            |
| `npm test`             | Run the unit test suite once (Vitest).         |
| `npm run test:watch`   | Run tests in watch mode.                       |
| `npm run lint`         | Lint with ESLint.                              |
| `npm run format`       | Format the codebase with Prettier.             |
| `npm run format:check` | Check formatting without writing (used in CI). |

The scheduling and scoring logic is covered by unit tests in `src/*.test.ts`. CI runs format-check, lint, tests, and build on every push before deploying.

## How it works

| File              | Responsibility                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| `src/schedule.ts` | Builds the round-robin schedule; balances partners, opponents, and sit-outs. |
| `src/scoring.ts`  | Tracks per-game points and computes cumulative standings (with ties).        |
| `src/storage.ts`  | Saves and loads sessions in `localStorage`.                                  |
| `src/share.ts`    | Encodes/decodes sessions to base64url share links.                           |
| `src/App.tsx`     | The UI tying everything together.                                            |

## Deployment

A GitHub Actions workflow (`.github/workflows/`) builds and deploys the app to **GitHub Pages** on every push to `main`. The base path is set automatically:

- `username.github.io` repos deploy to the site root (`/`)
- other repos deploy under `/<repo-name>/`

To enable it: **Repo → Settings → Pages → Build and deployment → Source: GitHub Actions.**

## Notes

- All data stays in your browser. Some browsers (e.g. Brave Shields or private/incognito mode) may block `localStorage` — the app detects this and shows a hint when saving fails.

## License

[MIT](./LICENSE)
