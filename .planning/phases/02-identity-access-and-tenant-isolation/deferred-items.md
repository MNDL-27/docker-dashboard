# Deferred Items

- `Task 1` verification blocker: API runtime smoke test could not run because Prisma client initialization fails at startup (`PrismaClientInitializationError` from `apps/api/src/lib/prisma.ts` path during `npm --prefix apps/api start`). This appears to be a pre-existing environment/runtime issue unrelated to Task 1 auth changes.
- `Task 2` verification blocker: `npm --prefix apps/web run build` fails on an unrelated pre-existing type error in `apps/web/src/components/fleet/HostList.tsx` (`AddHostDialogProps.projects` missing).
- `Task 2` verification blocker (current): `npm --prefix apps/web run build` fails before app compilation because pre-existing production transport guardrails in `apps/web/src/lib/transport.ts` reject non-HTTPS `NEXT_PUBLIC_API_URL` during `next.config.ts` evaluation (`[transport] NEXT_PUBLIC_API_URL must use https: in production`).
