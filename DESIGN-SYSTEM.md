# LeadRyze Design System

Brand foundation: InnooRyze (teal `#009EB5`, cyan `#00FFFF`, near-black `#1E1E1E`, coral `#FF4C60`, mint `#00D084`, Inter), translated for a dense, professional SaaS CRM rather than copied from the marketing site. Tone target: **premium, calm, information-dense, enterprise-ready — not neon, gradient-heavy, or glassy.**

This is a living pilot doc. What's marked **(built)** has real, verified code behind it (Sidebar, Header, Dashboard). Everything else is a documented convention for the next page that needs it — not yet exercised, so treat it as a starting point, not a finished spec.

## Foundation

### Color tokens **(built)**

New, additive tokens — the pre-existing `brand` (Tailwind stock indigo), `secondary`, `accent`, `dark` colors are untouched and still used by every page outside this pilot. Implemented as CSS custom properties (`frontend/src/index.css`, `:root` / `.dark`) wired into Tailwind (`tailwind.config.ts`) via `rgb(var(--x) / <alpha-value>)`, so `bg-background`, `text-text-primary`, etc. resolve automatically to the right theme with no `dark:` variant needed at the point of use.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | `#F7FAFA` | `#071316` | Page background, behind everything |
| `surface` | `#FFFFFF` | `#0B1C20` | Cards, sidebar, header |
| `surface-elevated` | `#FFFFFF` (shadow only) | `#10272C` | Dropdowns, modals, the mobile drawer |
| `text-primary` | `#1E1E1E` | `#F4FAFA` | Headings, primary text |
| `text-muted` | `#64748B` | `#94A7AA` | Secondary/meta text |
| `border` | `#E2E8F0` | `#19373C` | Dividers, card/input borders |
| `ryze-50…900` | teal scale, `600 = #009EB5` (official) | same in both themes | Primary brand accent — buttons, active states, links, focus rings |
| `success-500/600/700` | `#00D084`-anchored | same in both themes | Positive states only (e.g. conversion trending up) |
| `danger-500/600/700` | `#FF4C60`-anchored | same in both themes | Negative/urgent states only |
| `warning` | stock Tailwind `amber-*` | same | Caution states — InnooRyze's guide doesn't reserve a hue here |

**Rules**: teal is the one recognizable accent — not decoration on every element. No gradient on buttons/cards beyond the one deliberate brand touch (the sidebar logo mark). No glow effects, no glassmorphism, no oversized shadows. Semantic colors mean something specific or they don't get used — never per-tile decoration.

### Typography **(built)**

Inter only, no second typeface for product UI (Montserrat-for-CTAs is a marketing-site pattern; one consistent face reads calmer in a dense dashboard). Weights 300–900 all load (`index.html`) — `font-extrabold`/`font-black` previously rendered as synthetic bold because only 300–700 loaded.

| Role | Size / weight |
|---|---|
| Page title | `text-2xl font-bold` |
| Section heading | `text-base font-semibold` |
| Body | `text-sm` |
| Table / dense data | `text-sm` / `text-xs` |
| Metadata / captions | `text-xs`, `text-muted` |
| Metric / stat number | `text-2xl` to `text-3xl font-bold` (not `font-black` — reserve that weight for rare, deliberate emphasis) |

### Spacing, radius, shadow **(built)**

No new spacing scale — Tailwind's default is fine, used consistently. Radius: `rounded-xl`/`rounded-2xl` (existing `2xl: 1rem` override) for cards and panels, `rounded-lg` for buttons/inputs/nav rows. Shadow: `shadow-sm` for resting cards, `shadow-lg` reserved for genuinely elevated surfaces (dropdowns, the mobile drawer) — never stacked with a glow.

### Icons **(built)**

Heroicons outline, 24px source, already the app-wide convention — no change. `h-5 w-5` for top-level nav, `h-4 w-4` for sub-items and inline icons, always `shrink-0`.

### Motion **(built)**

`transition-colors`/`transition-all duration-150–200` for hover/active state changes (already the app's convention). Sidebar width and the theme background swap both transition over ~200ms. Mobile drawer slides in/out over ~200–250ms with the backdrop fading in parallel. Respect `prefers-reduced-motion` for anything longer than a simple color/opacity transition.

### Focus & accessibility **(built)**

Visible focus ring on every interactive element using the teal scale (`focus:ring-2 focus:ring-ryze-500`), never removed. Color is never the only signal — active nav state pairs a background tint with a text-color change, not color alone.

### Breakpoints **(built)**

Verified visually at all of: **1440, 1280, 1024, 768, 390, 375**. Below `768` (Tailwind `md`), the sidebar becomes a hamburger-triggered slide-over instead of a fixed column.

## Components

### Built this pass
- **Button** — primary (`ryze-600` fill, `ryze-700` hover, no gradient), secondary (bordered, surface fill), danger (`danger-600`). Consistent `rounded-lg`, `focus:ring-2 focus:ring-ryze-500`.
- **Input / Search** — `border-border`, `focus:border-ryze-500 focus:ring-ryze-500`. Global search keeps its existing `Ctrl K` shortcut (already wired, `UniversalSearch.tsx`) with the shortcut badge now visible in the Header.
- **Badge** — `success`/`danger`/`warning`/neutral variants, `rounded-full text-xs`.
- **Card** — `bg-surface border border-border rounded-2xl shadow-sm`, reserved for genuinely distinct groupings, not applied by default to every element (see Dashboard pattern below).
- **Sidebar nav item** — expanded row and collapsed-rail icon, active/hover states, section header with collapse chevron, per-item permission/feature-flag gating **completely unchanged** from the pre-existing implementation (see Patterns → Sidebar Navigation).
- **Header chrome** — search, filter chips, theme toggle, notifications, user menu, mobile hamburger.
- **Theme toggle** — sun/moon icon button, backed by `hooks/useTheme.ts`.
- **Mobile drawer** — slide-over with backdrop, used by the sidebar below `md`.
- **Empty / Loading state** — centered icon + one-line message (empty); skeleton blocks matching the real layout's shape (loading). Pattern already existed on Dashboard; now themed.

### Documented, not yet built (token references + a sensible default — verify before treating as final)
- **Select** — `Input`'s border/focus treatment + a `ryze-50` hover on options.
- **Tabs** — active tab: `text-ryze-600 border-b-2 border-ryze-600` (mirrors the existing Settings tab-bar pattern, retinted).
- **Tooltip** — `surface-elevated` background, `shadow-lg`, small `text-xs`.
- **Modal / Drawer** — `Modal.tsx` already exists (generic, neutral grays) — extend with `background`/`surface` tokens and dark-mode support when it's next touched.
- **Toast** — `react-hot-toast`, currently unthemed defaults; wire to tokens when a page redesign needs it.
- **Alert** — inline banner using the semantic colors at 10% background tint.
- **Avatar** — initials on a `ryze-600` fill (replacing ad hoc `blue-500→indigo-600` gradients found in the audit).
- **Breadcrumb** — `text-muted` with `text-primary` on the current segment.
- **Pagination** — neutral buttons, `ryze-50` active page.
- **Date Picker, Dropdown, Error state** — no existing implementation found to anchor a real spec; use Input/Card/Badge conventions above as the starting point.

## SaaS Patterns

### Dashboard **(built)**
Page-header block (title + context) → one cohesive KPI strip (not separate competing cards) → CRM-modules grid with light-touch chrome (no per-tile rainbow palette) → two analytics panels (real `Card` treatment — genuinely distinct content) → loading skeleton / empty states matching this same language. No fabricated sections — this pilot only restyles what the page actually has today.

### Sidebar Navigation **(built)**
Visual regrouping only — **every** `.filter()`, `canNav()`, `canNavFlag()` call and every entry in the five permission/feature-flag lookup maps in `Sidebar.tsx` is unchanged. The new section headers are a relabeling of exactly the existing gated items, nothing more:

```
OVERVIEW       Dashboard
ENGAGE         Customers · Bot Hub · Campaigns · Templates
INTELLIGENCE   Analytics · Knowledge Base
CRM            CRM Data (dynamic) · Native CRM
FIELD SERVICE  Field Service (22 items)
AUTOMATION     My CRM (Calendar / Management / Automation)
PLATFORM       Logs · Connectors · Settings
CONFIGURATION  Configuration · Custom Modules
```

Collapsed rail now has one icon per section above (previously Field Service/Configuration/Custom Modules had no collapsed-mode icon at all, despite being fully reachable expanded). Collapsed/expanded state and each section's open/closed state persist to `localStorage`.

### Documented, not yet built
- **CRM Table / Detail Page, Create/Edit Form, Kanban, Activity Timeline, Filter Bar, Bulk Actions, Settings Page, Analytics** — no changes made this pass; apply the Card/Badge/Button/type-scale conventions above when one of these is next redesigned.
- **AI Assistant / AI moments** — no AI content exists on the Dashboard today, so nothing was built here to demonstrate on. Convention for whenever a real one (Bot Hub, lead intelligence, etc.) is redesigned: a small sparkle/star icon marker, the `ryze` accent used restrained (a left border or icon tint, not a fully glowing box), `surface`/`surface-elevated` background — explicitly *not* a neon or heavily-gradient treatment, matching the "premium not flashy" rule above.

## Not touched in this pass
- The pre-existing `brand` Tailwind token (still stock indigo) and every page besides the app shell + Dashboard — unaffected, unmigrated, exactly as before.
- Dark-mode support for pages outside this pilot.
- Pipeline/stage colors elsewhere in the CRM — tenant-configurable data, not a styling decision.
- Any fabricated AI or business content.

The next pass, once this pilot's direction is approved, migrates the old `brand` token itself and rolls this same system out page by page.
