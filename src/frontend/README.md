# Interlude — Web frontend foundation

**BLG 411E · Nova · WBS-1.5** — React + TypeScript shared layout, client-side routing, and Django REST API client. This is a *foundation*, not the finished catalogue, player, chat, authentication, or analytics implementation.

## Run locally

Node.js **20.19+** is required (Node 22 LTS is a good choice).

```bash
cd src/frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to `http://127.0.0.1:8000` by default. Change `DEV_API_PROXY_TARGET` in `.env` if your Django backend runs elsewhere. If endpoints use a different URL prefix, set `VITE_API_BASE_URL` accordingly and update the proxy in `vite.config.ts` if needed. Never place secrets in `VITE_*` variables: they are exposed to the browser.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

The repository-wide testing guide requires tests in `tests/`. Frontend test specs are therefore stored at `tests/frontend/` (repository root), and `vite.config.ts` points Vitest there. Execute the commands above from `src/frontend` as shown.

Commit the generated `package-lock.json` when `npm install` succeeds, so team CI can use `npm ci`. No lockfile is included in this archive because dependency installation could not be performed in the preparation environment.

## URL contract

| Path | Future owner / feature |
| --- | --- |
| `/` | Home (catalogue team) |
| `/catalogue`, `/search?q=...` | Browse/search (catalogue team) |
| `/tracks/:trackId`, `/albums/:albumId` | Track and album details (catalogue/player team) |
| `/rooms`, `/rooms/:roomId` | Room listing, room, chat (real-time team) |
| `/playlists`, `/playlists/:playlistId` | Playlists (catalogue/player team; FR-47/48) |
| `/login`, `/register` | Authentication team (uses `AuthLayout`) |
| `/profile`, `/profile/edit`, `/musicians/:musicianId` | Profiles team |
| `/profile/followers`, `/profile/following`, `/users/:userId` | Follow/followers (profiles team; FR-45/46) |
| `/musicians/:musicianId/report` | Copyright-report form (profiles team; FR-52) |
| `/dashboard` | Musician-only analytics (analytics team) |
| `/admin/reports` | Admin reports (auth/profiles team; FR-52) |
| Any unknown path | `NotFoundPage` |

**Protected routes (FR-01):** The base shell requires an authenticated session, dashboard allows only `musician`, and report moderation allows only `admin`. `Navigation` hides role-inappropriate entries. These tests verify UI behavior only; Django must validate every protected API and WebSocket message. To preview routes while backend auth is unfinished, set `VITE_DEV_PREVIEW_ROLE=listener` (or `musician`/`admin`) in your local `.env`; this flag is ignored by production builds and must never be treated as a real login.

**Routing implementation:** `src/app/AppRoutes.tsx` installs `AppLayout` and `AuthLayout` once. Each feature team can edit **its own** `src/features/<feature>/routes.tsx` and replace `FeaturePlaceholder` with their actual page. URL definitions and link builders live in `src/app/paths.ts`; use them instead of hard-coded route strings. This minimizes merge conflicts when multiple teammates work in parallel.

**Shared layout:** `src/layouts/AppLayout.tsx` includes responsive sidebar navigation, top search form, content outlet, reserved common player bar (`PlayerBar.tsx`), and footer. The form navigates to `/search?q=...`; fetching results is the catalogue owner's responsibility. The home screen is a temporary preview and will be replaced by the catalogue team. `src/layouts/AuthLayout.tsx` hosts login and registration separately.

**API client:** `src/lib/api/client.ts` exports `api.get/post/put/patch/delete`, `apiRequest`, and `ApiError`. Example:

```ts
import { api } from '../../lib/api/client';

type Song = { id: string; title: string };
const songs = await api.get<Song[]>('songs/', { query: { q: 'jazz' } });
// => GET /api/songs/?q=jazz
```

- The foundation deliberately **does not guess** actual Django endpoints or implement auth; agree on endpoint paths and response types before feature integration.
- JSON `data` is serialized automatically. For audio uploads, call `apiRequest('your-upload-path/', { method: 'POST', body: formData })`, which leaves multipart boundaries to the browser.
- Cookie auth uses browser cookies (same-origin by default) and sends Django's `csrftoken` cookie on unsafe methods if readable. For cross-origin cookie auth, Django CORS, credentials, and CSRF trusted origins must be configured together.
- If the auth team uses bearer access tokens, it can register an **in-memory** provider via `setAccessTokenProvider(() => accessToken)`. No token is stored in localStorage by the foundation.
- `AppRoutes` contains client-side guest/role guards. `SessionProvider` defaults to guest until the authentication owner wires it to a backend-verified session; local developer preview is explicitly opt-in. Django must still enforce server-side permissions on every request.
- The shared `PlayerBar` is a **non-interactive reserved slot**, not a music player; the WBS-8.2 owner adds play/pause/seek/queue and stream integration later. It should replace the slot content without moving the common layout.

## New feature development

1. Create your feature page in its own feature directory, e.g. `src/features/rooms/RoomPage.tsx`.
2. Replace the placeholder `element` for its path in your feature's `routes.tsx`.
3. Reuse `AppLayout`, `paths`, and `api` instead of duplicating layout or networking logic.
4. Place frontend tests in the repository-root `tests/frontend/` directory, run `npm run lint && npm run typecheck && npm run test && npm run build`, and open your own PR into `development`.

## Git workflow (`development` → feature branch → PR)

Run the following **at the repository root** after cloning. Avoid working directly on `development` or `main`:

```bash
git fetch origin
git switch development
git pull --ff-only origin development
git switch -c feature/frontend-foundation
# Copy the archive's src/frontend contents to the repo's src/frontend.
git add src/frontend tests/frontend
git commit -m "feat(frontend): implement shared layout and routing (WBS-1.5)"
git push -u origin feature/frontend-foundation
```

Open a PR with **base = `development`**, **compare = `feature/frontend-foundation`**. Merge to `development` after code review and CI checks; release integration into `main` can be managed separately. The archive includes no `.git` directory, credentials, or generated build files. The pre-existing `src/frontend/.gitkeep` can be left as-is or deleted in your branch.

## GitHub tracking and course guide compliance

- Keep the WBS-1.5 task/issue assigned on the GitHub Projects board and maintain its status.
- Submit your own feature PR using your own GitHub account, with a teammate review and passing checks before merge.
- Reference the WBS and the relevant issue in the PR description; add `Closes #123` with the actual issue number only when appropriate. Customer-request issues specifically require that closing link and the exact `customer-requests` label.
- Feature PRs target `development` under the team branch workflow. The course guide prescribes **PRs to `main` plus a named release and TA review for document deliverables**; do not confuse document submission releases with feature development.
- Ensure the repository-root `README.md` lists every team member and both their development and management roles. This module README is not a substitute.
- Before merging, verify frontend tests run in CI. The archive has no dependency lockfile; commit `src/frontend/package-lock.json` after a successful `npm install`.

## Requirements mapping (current RequirementsSpec.md; subject to revision)

- **WBS-1.5 / FR-01 / NFR-11:** shared responsive navigation + header + reserved player slot + role-gated client-side route shells. Tests: `tests/frontend/AppRoutes.test.tsx`.
- **FR-45/46, FR-47/48, FR-52:** placeholders/routes only (profiles, following, playlists, copyright reports). Business logic, backend and full page UI remain with their assigned owners.
- **FR-24/25 and FR-05–09:** no real playback or authentication in this deliverable. The actual streaming/player and auth workstreams integrate later.
- **FR-02 / NFR-16:** tests are under repository-root `tests/frontend/`. The CI owner must still configure repo-wide PR checks and coverage reporting.
- **Release note:** `feature/frontend-foundation` PR targets `development` per the team workflow. Official **document** submissions follow the course guide's own branch/release/TA-review instructions and are separate from this feature PR.

## Important integration limitations

By default feature routes redirect to `/login` because no backend session is connected yet. This is intentional: do not ship a fake authenticated user. For local UI inspection only, set the preview role in `.env`, and do not commit that file. The auth owner should replace preview-only state with backend-verified identity and restore the originally requested route after login.

The route table is a proposed URL contract; changes to the Requirements Specification or backend URL design should be reviewed with each feature owner before updating the shared paths.
