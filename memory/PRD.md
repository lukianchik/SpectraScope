# SpectraScope · PRD

## Original problem statement
> Study the project and create a beautiful website featuring functional pages, tabs, and visual effects. Deliver high-quality UX/UI design that aligns with the project's theme, building upon the concept that has already been implemented.

User direction (Jan 26, 2026):
- Landing + full internal pages set
- Keep current navy + accent theme, but improve and add effects
- All visual effects (animated background, glassmorphism, micro-animations, custom cursor, animated SVG charts)
- Don't change backend
- Keep interface language in English

## Project
SpectraScope is an MVP cyber-intelligence platform for authorized external attack-surface analysis. A user submits a domain or approved lab target → backend (FastAPI + Celery + Postgres + Redis) runs a safe scanner pipeline (subfinder → httpx → nuclei → optional nmap) → assets, findings, and a risk report are exposed via API. Defaults to `ENABLE_REAL_SCANNERS=false` (mock results) for safety.

## Architecture
- Backend: FastAPI · Python 3.11 · SQLAlchemy · Alembic · Pydantic · Celery · Postgres · Redis (unchanged)
- Frontend: Vite · React 19 · TypeScript · SCSS modules · react-router-dom v7 · @tanstack/react-query · lucide-react
- API base URL is read from `VITE_API_BASE_URL`. When the backend is unreachable, the frontend transparently falls back to a built-in `DEMO_*` dataset so the UI is fully explorable in the preview.

## User personas
- **Security admin** — runs scans, triages findings, exports reports.
- **Engineering lead** — checks findings tied to their service.
- **Compliance / Exec** — reads risk reports, sees executive summary.

## Core requirements (static)
1. Beautiful, distinctive UI faithful to navy + cyan/aqua + violet accent palette.
2. Landing page that explains the product, the pipeline, and safety posture, with a clear CTA into the console.
3. Authenticated-looking console with sidebar nav and the following pages:
   - `/dashboard` — Mission Control (Start Scan + Status + Metrics + tabbed Overview / Trends / Activity)
   - `/scans` — historical scan table with status/profile filters, search, refresh, "start scan" CTA
   - `/assets` — discovered host inventory as cards with technology tags
   - `/findings` — severity-filtered list with click-to-open detail drawer
   - `/reports` — sidebar list + detailed report view with summary, top risks (score bars), recommendations
   - `/monitoring` — observability tiles with sparklines + 6-service health list
   - `/integrations` — 6 toggleable connectors (Slack, PagerDuty, Jira, GitHub, Splunk, AWS GuardDuty)
   - `/settings` — target authorization, scanner safety, notifications, API key
4. Visual effects: animated aurora background, radar sweep, faint grid + grain overlay, custom cursor, glass cards, hover micro-animations, staggered reveals, SVG charts.
5. Backend untouched.

## Implemented (2026-01-26)
- Router with BrowserRouter and `MainLayout` outlet, demo banner when API unreachable
- 8 fully wired pages + landing
- Sidebar with `NavLink` highlighting and system summary card
- `Background` widget (aurora + radar halo + rings + scan-line) and `Cursor` widget (dot + lagging ring, hover and click states)
- Custom font stack (Bricolage Grotesque + Outfit + JetBrains Mono)
- Tabs in `/dashboard` (Overview / Trends / Activity) with SVG line chart and weekly deltas
- Findings drawer with metadata grid, score, triage actions
- Reports view with executive summary, top risks (gradient score bars), recommendations
- Monitoring with sparklines and warn-tone state on Celery scans worker
- Integrations toggle (with `role="switch"` + `aria-checked` for a11y)
- Settings form with multiple toggles, textareas, key field, save indicator
- API client emits `NetworkUnavailableError` on fetch failure; data hooks transparently substitute the `DEMO_*` dataset, so the preview works end-to-end without a reachable backend
- Vite config opens `allowedHosts: true` and forces port 3000 to match Kubernetes supervisor
- Frontend supervisor unblocked by adding a `start` alias to package.json scripts

## Known limitations
- Backend remains the original FastAPI app expecting Postgres + Redis. It is started by supervisor but `/api/scans` returns 503 until a real DB is provisioned. The frontend handles that gracefully via demo fallback. Per user instruction, backend is not modified.
- Search shortcut hint `⌘K` is visual only (no command palette wired yet).
- "Export PDF" button in Reports is decorative.

## Prioritized backlog
### P0
- Wire a real Postgres + Redis (or in-memory SQLite) so backend can serve live data in preview.
### P1
- Add a command-palette (⌘K) for fast navigation, scan-start and finding search.
- Implement Reports PDF export (HTML to PDF via backend route).
- Add per-scan deep-link route (`/scans/:id`) that reuses Dashboard's overview shell.
### P2
- Per-user auth and org/project scoping (already on backend's roadmap).
- Real-time updates via WebSocket instead of polling.
- Theme toggle (lighter navy variant).

## Next tasks
- (Optional) Hook the Postgres + Redis sidecars so the live API path stays warm during demos.
- (Optional) Expand the Settings panel into a real workspace settings POST endpoint once auth lands.

## Files of note
- `frontend/src/app/App.tsx` — router
- `frontend/src/layout/MainLayout.tsx` — sidebar + outlet + demo banner
- `frontend/src/widgets/Background/Background.tsx` — animated radar / aurora / grid
- `frontend/src/widgets/Cursor/Cursor.tsx` — custom cursor
- `frontend/src/pages/*` — Landing, Dashboard, Scans, Assets, Findings, Reports, Monitoring, Integrations, Settings
- `frontend/src/shared/mock/demoData.ts` — DEMO_* dataset
- `frontend/src/shared/hooks/useScansData.ts` — React Query hooks with demo fallback
