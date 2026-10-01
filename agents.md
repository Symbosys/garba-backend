# GarbaMitra Agent Guide

## Architecture
- `backend/`: Bun + TypeScript + Express 5 REST API, Prisma 7, PostgreSQL, JWT auth, Zod validation.
- `frontend/`: React 19 + Vite + TypeScript + Tailwind, React Router, TanStack Query.
- API base: `/api/v1`; frontend base URL: `VITE_API_BASE_URL` (default `http://localhost:4000/api/v1`).
- Schema: `backend/prisma/schema.prisma`; plan: `backend/API_IMPLEMENTATION_PLAN.md`. Persisted domains are users, payments, photos, events, and event images; other legacy screens may use mock/local data.

## Roles and Access
- `PARTNER`: approved normal user; can discover approved partners and published events.
- `ORGANIZER`: approved event user; owns and manages events and event images.
- `SUPER_ADMIN`: single owner; reviews registrations/payments and views metrics/users/events.
- Public registration accepts only `PARTNER` or `ORGANIZER`; privileged users are provisioned operationally.

## Core Flow
1. Client reads the server-owned fee from `GET /public/registration-config` (`REGISTRATION_FEE_PAISE` in `backend/src/config/constants.ts`).
2. `POST /auth/register` receives multipart fields, 1-5 `profilePhotos`, and one `paymentScreenshot`.
3. Images are signature-checked, normalized with Sharp, then uploaded through the selected cloud provider.
4. User and payment are created atomically as `PENDING`; user fields include mandatory `age` (14–100), email is lowercase, and phone is normalized.
5. Super admin reviews the protected profile/payment detail and approves or rejects it transactionally.
6. Only `APPROVED` accounts can log in. JWT requests reload role/status/version; redirects are partner `/dashboard`, organizer `/events/my-events`, owner `/admin`.

## Backend Modules and APIs
- `modules/auth`: registration, login, current user, registration configuration.
- `modules/discovery`: approved partner list/detail; never expose partner email, phone, address, password, or payment data.
- `modules/events`: published discovery plus organizer-owned event CRUD and image management.
- `modules/admin`: `/super-admin/dashboard`, filtered registrations, registration review, all-event list/detail.
- Money is integer paise; timestamps are UTC; coordinates are decimal. Approval updates `User.status` and `RegistrationPayment.status` transactionally.

## Frontend Data Flow
- `src/lib/api-client.ts`: typed response envelope, bearer injection, API errors, unauthorized-session clearing.
- `src/context/AuthContext.tsx`: token persistence, `/auth/me` restoration, role-derived access.
- `src/api/admin.ts`: super-admin API client. Admin pages use TanStack Query; mutations invalidate dashboard/list/detail keys.
- `/admin/users`: `PARTNER` and `ORGANIZER` tabs with server-side status/search/pagination and payment review drawer.
- `/admin/events`: live read-only event directory; all `/admin` routes require backend-confirmed `SUPER_ADMIN`.

## Storage
- Set exactly one `STORAGE_PROVIDER`: `CLOUDINARY`, `AWS_S3`, or `AZURE_BLOB`.
- Only the selected provider's credentials are validated; default is `CLOUDINARY`.
- Factory: `backend/src/lib/storage/storage.factory.ts`; never trust MIME alone, expose public IDs, or leave uploads after failed DB writes.

## Package Managers and Commands
- Backend uses Bun: `cd backend && bun install`, `bun run dev`, `bun test`, `bun run typecheck`.
- Database: `bun run db:validate`, `bun run db:generate`, `bun run db:migrate`; provision with `SUPER_ADMIN_*` then `bun run super-admin:create`.
- Frontend uses npm lockfile: `cd frontend && npm install`, `npm run dev`, `npm run build`, `npm run lint`.

## File-Scoped Checks
| Task | Command |
|---|---|
| Backend test | `cd backend && bun test src/path/file.test.ts` |
| Frontend lint | `cd frontend && bun node_modules/eslint/bin/eslint.js src/path/file.tsx` |

## Conventions
- Keep controllers HTTP-focused; schemas validate input; Prisma queries enforce ownership and allowlisted output.
- Use `asyncHandler`, centralized errors, explicit DTO/select fields, bounded pagination, and role middleware.
- Cloud uploads require compensating cleanup; do not add chat, matching, ticketing, favorites, or notification APIs unless requested.
- **Client-Side Image Handling**: In the registration page or anywhere images are handled, always display instant visual previews upon upload and compress images strictly under 100KB on the client before submission.
- **UI & Feedback**: The authentication and registration interface uses a clean, professional Garba aesthetic in light mode. Every user action must trigger an informative toast notification (`showToast`).

## Commit Attribution
AI commits MUST include `Co-Authored-By: <agent model/name> <noreply@example.com>`.
