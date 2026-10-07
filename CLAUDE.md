# msgbusviz

Done gate: `npm ci && npm run build && npm run typecheck && npm run lint && npm test` — build, typecheck (`tsc -b`), lint, and all Node unit tests (286 as of 2026-10-06) must pass.

## Platform binaries

npm skips optional native bindings when installing from the lockfile, so the darwin-arm64 bindings that the build needs are pinned as root devDependencies: `@rolldown/binding-darwin-arm64`, `@rollup/rollup-darwin-arm64`, `lightningcss-darwin-arm64`. Bump them together with rolldown, rollup and lightningcss (via vite).
