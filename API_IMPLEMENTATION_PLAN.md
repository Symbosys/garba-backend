# GarbaMitra backend: database and API implementation plan

## Scope

This backend implements only partner/organizer registration, payment-proof review, approval-gated login, approved partner/event discovery, and organizer-owned event management. Chat, partner requests, ticketing, favorites, notifications, and matching are intentionally out of scope.

## Data model

- `User`: unique normalized email and E.164 phone, password hash, address, gender, `PARTNER | ORGANIZER | SUPER_ADMIN` role, and approval state. Privileged roles cannot be selected by public registration. A single `SUPER_ADMIN` is provisioned operationally.
- `UserPhoto`: ordered cloud assets belonging to a user.
- `RegistrationPayment`: exactly one submission per user. It snapshots the server-controlled fee in paise, stores the cloud payment-proof metadata, and records the admin decision, reviewer, time, and rejection reason.
- `Event`: organizer-owned details, venue/address, decimal latitude/longitude, UTC start/end times, entry fee in paise, capacity/contact fields, publication state, and soft deletion.
- `EventImage`: ordered cloud assets belonging to an event.

Important database/API invariants:

1. Email is stored lowercase and phone is stored in E.164 form before unique checks.
2. New accounts and payments start `PENDING`; no token is issued at registration.
3. Admin review changes account and payment status atomically. A conditional update prevents a second concurrent review.
4. Only `APPROVED` users can authenticate. Protected requests reload status, role, and token version from the database.
5. Only an approved organizer can mutate an event, and ownership is included in every mutation query.
6. Discovery exposes allowlisted fields only; partner email, phone, street address, payment data, and password hash are never returned.
7. Monetary values use integer paise. The editable current registration fee is `REGISTRATION_FEE_PAISE` in `src/config/constants.ts`.

## REST API (`/api/v1`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/public/registration-config` | Public | Current server fee/currency and allowed roles |
| POST | `/auth/register` | Public, multipart | Register partner/organizer with `profilePhotos` and one `paymentScreenshot` |
| POST | `/auth/login` | Public | Login approved account and return role-specific `redirectTo` |
| GET | `/auth/me` | Approved user | Own profile |
| GET | `/partners` | Approved user | Paginated approved partner list; city/state/gender filters |
| GET | `/partners/:partnerId` | Approved user | Safe approved partner profile |
| GET | `/events` | Approved user | Paginated published event list; city/state/date filters |
| GET | `/events/:eventIdOrSlug` | Approved user | Published event details |
| GET/POST | `/organizer/events` | Organizer | List/create owned events; create uses multipart `images` |
| GET/PATCH/DELETE | `/organizer/events/:eventId` | Organizer owner | Read/update/soft-delete an owned event |
| POST | `/organizer/events/:eventId/images` | Organizer owner | Add event images, max 10 total |
| DELETE | `/organizer/events/:eventId/images/:imageId` | Organizer owner | Delete an event image |
| GET | `/super-admin/dashboard` | Super admin | Aggregate user, payment, revenue, and event metrics |
| GET | `/super-admin/registrations` | Super admin | Paginated registrations filtered by partner/organizer and status |
| GET | `/super-admin/registrations/:userId` | Super admin | Registration and protected payment-proof detail |
| PATCH | `/super-admin/registrations/:userId/review` | Super admin | `{ decision: "APPROVE" }` or `{ decision: "REJECT", reason }` |
| GET | `/super-admin/events` | Super admin | Paginated platform event directory |
| GET | `/super-admin/events/:eventId` | Super admin | Event, images, and organizer detail |

## Rollout

1. Set `DATABASE_URL`, a 32+ character `JWT_SECRET`, cloud storage credentials, and production `FRONTEND_ORIGIN`.
2. Review the generated SQL migrations in staging and apply them. Provision the owner account (never public registration) with `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PHONE`, `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_NAME`, then run `bun run super-admin:create`.
3. Verify uploads and cleanup behavior against the chosen cloud provider, especially payment-proof access policy.
4. Run type checking and integration tests against an isolated PostgreSQL database, then deploy with a database backup and application rollback artifact.
