# Dependency Upgrade Notes

## React & React Router
- Current: `react@19.1.1`, `react-dom@19.1.1`, `react-router-dom@7.9.1` (release candidates).
- Before upgrading to stable React 19 or reverting to React 18, confirm compatibility of:
  - `react-router-dom@7`: new data APIs and `Route` patterns. Review migration guide for `createRoutesFromChildren` changes.
  - Verify third-party libraries (e.g., `lucide-react`) support React 19.
- Action: follow official React 19 release post; re-run integration tests with Suspense/Actions if adopted.

## Express & Middleware
- `express@5.1.0` introduces async route handling; upcoming 5.2 may change error propagation.
- Ensure custom middleware uses `next(err)` semantics and avoid relying on legacy body-parser behaviour.
- After upgrade, rerun all upload and auth flows; validate multer compatibility.

## Tailwind & Vite
- `tailwindcss@4.1.13` and `@tailwindcss/vite` 4.x are preview builds.
- Tailwind 4 modifies theming (`@theme`) and removes `tailwind.config.js` for simple setups; double-check custom utilities before upgrading.
- Vite 7 is already active; monitor release notes for breaking CSS bundling changes when Tailwind stabilises.

## Database & Validation
- `mysql2@3.15.0`: next major will require Node 18+ and changes default timezone handling. Review connection options before bumping.
- `zod@4.1.9` is alpha. Keep track of API changes (e.g., `.shape` removals) and pin to stable v3 if ecosystem lags.

## Tooling
- `typescript@5.9.2`: watch for 5.10+ features requiring config updates (`moduleResolution: bundler` adjustments).
- `tsx@4.20.x`: verify compatibility with updated TypeScript before bumping.

## Action Items
- Configure automated smoke tests (login, upload, balances) before running upgrades.
- Maintain changelog entries per dependency to track tested versions.
