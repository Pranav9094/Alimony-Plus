# Integration notes: intake, Legal-Route Navigator, Document Readiness

## New backend endpoints (all require a signed-in user and ownership of the case)

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/api/cases/:id/intake` | Read / save the 9 guided-intake answers (allow-listed values only; missing answers become `unknown`) |
| GET | `/api/cases/:id/navigator` | Possible legal routes from the saved intake, each with source, effective date, review date and review status; safety-first response when a risk is disclosed |
| GET | `/api/cases/:id/checklist` | Document Readiness checklist built from the intake and the documents already added |
| GET | `/api/documents/case/:caseId` | Safe document metadata for a case (no storage paths) |

Rules live in `backend/services/` (`intake.js`, `legalRoutes.js`, `checklist.js`). Route sources use the blueprint's source register; every route is marked `pending-legal-review` until a qualified reviewer approves it.

## Database

Apply once on an existing database (do **not** use `prisma db update` here: it would drop the manual RLS policy on `Document`):

```
psql "$DATABASE_URL" -f backend/prisma/intake.sql
psql "$DATABASE_URL" -f backend/prisma/rls.sql   # only if not applied yet
```

## Security changes

- Server: `helmet`, no `x-powered-by`, 100 kb JSON limit, clean 400/404/413 errors, required env vars checked at start-up, `PORT` from env.
- Auth: JWT algorithm pinned to HS256; decoded token and key length are no longer logged.
- Uploads: file bytes must match the declared type; document category must be on the allow-list; case ownership is checked before anything is written to disk.
- Downloads: safe `Content-Disposition`, `nosniff`, `no-store`, MIME re-checked against the allow-list.
- All `/api/cases/:id` routes validate the id.
- Fixed a start-up crash on case-sensitive file systems (`createPartyController.js` file name).
- Removed nothing from the existing API contract.

## Tests

```
cd backend && BASE_URL=http://127.0.0.1:5000 npm test     # 15 integration/security tests (needs running backend + DB; set LOGIN_RATE_LIMIT_MAX=1000 on the server for repeated runs)
cd frontend && npm run typecheck && npm test && npm run build
```

The backend suite covers unauthenticated access, cross-user IDOR on reads and writes, id validation, stored-XSS payloads, spoofed uploads, safety-first routing, overlap flagging, privacy of responses and header hardening.

## Known limits

- Navigator rules cover the routes in the blueprint only; they have not had qualified legal review.
- Emergency numbers (112, 15100) must be verified for the user's jurisdiction before public launch.
- Intake, navigator and checklist need a signed-in workspace; demo mode shows a sign-in prompt.
- The Playwright end-to-end specs were not run in this environment.
