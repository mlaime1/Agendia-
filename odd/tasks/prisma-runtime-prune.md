# Optimized Prisma runtime packaging
Northflank deployment should generate and compile the Prisma client, then prune build-only dependencies before runtime packaging.
This feature preserves the generated Prisma runtime client and leaves the existing Supabase database untouched.

## Specs

S1. The user asked: “prepara esa version optimizada”

S2. The user asked to explain: “Mi recomendación: primero ajustar el paquete y el comando de deploy de Northflank para compilar y correr las migraciones antes de podar dependencias;”

S3. The user asked: “y que es \"deja el cli de prisma en produccion\"”

S4. The user clarified: “la bd de supabase tiene datos ya andando, no hay que tocar nada ahi.” No database migrations or other database writes are in scope.

## Tasks

T1 | S1,S4 | Inline: update runtime/build dependency placement and post-build prune hook; do not add migration execution | commit pending
T2 | S1,S4 | Verify production prune preserves generated client/runtime imports and run focused checks without database writes | commit pending
T3 | S3 | Explain the CLI/runtime distinction in the final response | no code commit

## Log

L1. Original request: “prepara esa version optimizada y explicame esto
 Mi recomendación: primero ajustar el paquete y el comando de deploy de Northflank para compilar y correr las migraciones antes de podar dependencias;
y que es \"deja el cli de prisma en produccion\"”

L2. Evidence: an isolated `npm prune --omit=dev --omit=optional --ignore-scripts` after generation removed Prisma CLI and TypeScript while retaining `@prisma/client` and generated files. This verifies the runtime dependency tree, but not reduction of the Northflank image: pruning at container start occurs after image creation and cannot remove bytes from earlier image layers. The repository has no Northflank deployment configuration, so the build/start mode and command must be confirmed before choosing where pruning and migrations run.

L3. User confirmed the Northflank service is a Buildpack connected directly to the GitHub repository. The current runtime uses the package `start` script.

L4. User-provided Northflank logs identify `heroku/nodejs 5.9.1`, `npm ci --include=dev`, Node `26.x` defaulting to `26.13.1`, and npm `11.20.0`. This confirms dev dependencies are installed during build; the app starts with `npm start`.

L5. User correction, verbatim: “que migraciones? la bd de supabase tiene datos ya andando, no hay que tocar nada ahi”. Do not run or add automatic database migrations/writes. Based on the Buildpack logs, dependency pruning belongs in the post-build hook; the database remains untouched.

L6. Verification: isolated Buildpack-like sequence `npm ci --include=dev` → `npm run build` → `npm run heroku-postbuild` passed. Generated `.prisma/client` (16 files) and `@prisma/client` remained; `prisma` CLI and TypeScript were removed; runtime import + `PrismaPg` adapter + `passenger` model loaded without connecting to a database. Result: 226 packages / 177 MB `node_modules`. In the repo, `npx tsc --noEmit`, 21 unit suites / 248 tests, and `git diff --check` passed. No database command was run.

L7. First independent verifier launch was cancelled before probes; it was not retried automatically.

L8. One final user-authorized independent verification completed. It confirmed prune behavior, no DB writes, package-lock consistency, and Node support; it could not confirm the Northflank image contains the `heroku-postbuild` result because no candidate build log was available. It also advised narrowing `engines.node` from `22.x` to a Prisma-compatible minor range.

L9. User supplied the prior Northflank build log: it shows `npm run build`, then the Heroku Node.js Buildpack pruning dev dependencies, followed by `Starting EXPORT Phase` and saving the image. Combined with the official Heroku Node.js Cloud Native Buildpack documentation (which specifies `heroku-postbuild` after `build`), this confirms the intended hook runs before the buildpack's final prune/export. The supplied log predates this candidate; the candidate-specific hook line will appear only in a subsequent build.

L10. The user explicitly requested: “commit y push”.
