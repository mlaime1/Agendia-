# Deprecate automatic summaries
Tracks the requested retirement of the backend's scheduled and on-demand automatic-summary paths.

## Specs
- S1: “Creo que la rama actual no tiene cambios. yo lo que necesito es deprecar el tema de los resumenes automaticos.”
- S2: “Cron y ruta auto” — “Retirar también `/summaries/auto/:clientId` y su lógica; implica cambio del contrato API.”

## Tasks
- T1 | S1-S2 | inline | status: done | commit: b282266 — Remove automatic summary scheduling and the on-demand auto endpoint/logic; update tests, OpenAPI, and documentation.

## Log
- L1: “Creo que la rama actual no tiene cambios. yo lo que necesito es deprecar el tema de los resumenes automaticos.”
- L2: “listo ahora si. retry”
- L3: Selected scope: “Cron y ruta auto” — “Retirar también `/summaries/auto/:clientId` y su lógica; implica cambio del contrato API.”
- L4: `src/server.ts` starts the daily scheduler; `src/modules/summaries/scheduler.ts` invokes `processAutoSummary`; `docs/SUMMARIES.md` documents `POST /summaries/auto/:clientId`; `docs/TIMEZONE.md` documents the cron schedule. Manual summary creation is a separate path.
- L5: The first Jest attempt (`npm run test:unit -- --runInBand tests/unit/modules/summaries/deprecation.test.ts`) timed out after 30 seconds before emitting test results. No production source changes have been made.
- L6: User authorized one corrected file-scoped run: `npx jest --runInBand --runTestsByPath tests/unit/modules/summaries/deprecation.test.ts`; stop if it fails or times out.
- L7: The authorized run produced RED: `startSummaryScheduler()` called `cron.schedule('0 1 * * *')`, `POST /summaries/auto/5` returned 201, and the manual-summary route test passed. Per the explicit stop-on-failure limit, no production implementation or further test run occurred; the new regression test remains in the worktree.
- L8: User renewed authorization to implement removal of both cron and the auto endpoint, update tests/docs, and run necessary verification, with no subagents and no database changes.
- L9: Removed the startup cron hookup, auto endpoint/controller/service/type logic, and OpenAPI route; retained manual summaries and billing-period preview. Updated summary, timezone, and project-flow docs. Focused summary tests: 4 suites / 57 passed; full unit suite: 17 suites / 222 passed; `npm run build` passed; built `dist` has no auto-route/scheduler references. RDD mode is off; no DB changes or subagents.
- L10: T1 is held by commit `b282266` (`feat(summaries): retire automatic summary generation`). Risk: none; only the specifically requested automatic-summary behavior and API path were removed, while manual summary and preview flows remain.
