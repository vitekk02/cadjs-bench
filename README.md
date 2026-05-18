# cadjs-bench

Benchmark harness and case-study renderer for the [`@vitekk02/cadjs`](https://www.npmjs.com/package/@vitekk02/cadjs) library. Installs the library from npm and exercises it through its public entry points (`@vitekk02/cadjs`, `@vitekk02/cadjs/react`), so the same measurements also serve as integration evidence for an external consumer.

## What's inside

Two Vite entry points, built side by side:

- **`bench.html` → `src/bench.tsx`**: interactive scenario runner. Each scenario in `src/scenarios/` runs through the library API and reports timings via `src/timing.ts` and `src/frameTimer.ts`. Current scenarios: `coldStart`, `sketchSolver`, `booleanOps`, `extrude`, `fillet`, `sweep`, `workerOffload`, `postMessageRoundtrip`.
- **`case-studies.html` → `src/case-studies.tsx`**: renders three reference mechanical parts (`flange`, `hub`, `bracket`) modelled entirely through the public API, plus a faceted A/B comparison for the flange that demonstrates lossless analytic-geometry preservation across kernel operations. Sources live in `src/case-studies/`.

Supporting files:

- **`src/AppLoader.tsx`**: boots OpenCascade and planegcs WASM before mounting the bench / case-study UI.
- **`src/fixtures.ts`**: shared geometry inputs used by multiple scenarios.
- **`playwright/case-studies.spec.ts`**: headless screenshot capture for thesis figures.

## Run it

```bash
npm install
npm run dev          # vite dev server on http://localhost:3001
```

Open `http://localhost:3001/bench.html` for the scenario runner, or `http://localhost:3001/case-studies.html` for the case-study viewer.

## Build it

```bash
npm run build        # emits dist/bench.html and dist/case-studies.html
npm run preview      # serve the built bundle locally
```

## Take screenshots

```bash
npx playwright install   # first run only
npm run screenshot       # captures case-study figures via playwright/case-studies.spec.ts
```

## Cross-origin isolation

OpenCascade.js uses `SharedArrayBuffer`, which requires cross-origin isolation. The dev server is preconfigured in `vite.config.mts` with the required headers:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy:   same-origin
```

## License

MIT
