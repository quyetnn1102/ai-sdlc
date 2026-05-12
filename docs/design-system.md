# SDLC Hub — Frontend Design System

> **Last updated**: 2026-05-09
> **Status**: Design tokens defined; components need to adopt them (see Phase 0 in implementation-plan.md)

---

## 1. Design Inspiration

SDLC Hub is a developer tool. The UI takes inspiration from products developers use daily:

| Reference | Style | Key Learning |
|---|---|---|
| **Linear** | Dark | Project management, 4px grid, Inter font, minimal chrome |
| **Vercel** | Light/Dark | Developer platform minimal, pixel-perfect typography |
| **GitHub** | Dark | Developer-native, data dense but organized |
| **Supabase** | Dark | Database dashboard, sidebar navigation, table views |
| **Retool** | Light | Internal tool builder, form/table/chart dense but ordered |

**Direction**: Linear-inspired dark mode with a cool accent (blue-indigo), clean sidebar, Inter font, 4px/8px spacing grid.

---

## 2. Design Tokens

### 2.1 Color System

```css
/* Background layers */
--bg-app:        #0F0F0F;   /* App shell background */
--bg-surface:    #161616;   /* Cards, panels, modals */
--bg-elevated:   #1E1E1E;   /* Popovers, dropdown, code blocks */
--bg-hover:      #FFFFFF08; /* Hover state overlay */

/* Text */
--text-primary:   #FFFFFFDB; /* Main content text */
--text-secondary: #FFFFFF73; /* Labels, subtitles, metadata */
--text-disabled:  #FFFFFF40; /* Disabled text */

/* Border */
--border-subtle:  #FFFFFF12; /* Dividers, card outlines */
--border-default: #FFFFFF20; /* Input, table borders */
--border-strong:  #FFFFFF40; /* Focus ring, selected state */

/* Accent */
--accent-primary: #4F6EF7;   /* Blue-indigo — interactive elements */
--accent-hover:   #3D5CE8;
--accent-subtle:  #4F6EF712; /* Tinted backgrounds */

/* Status colors */
--status-success: #22C55E;
--status-warning: #F59E0B;
--status-danger:  #EF4444;
--status-info:    #3B82F6;
--status-neutral: #6B7280;
```

**Rules:**
- Use `--bg-surface` for all cards and panels — never arbitrary hex.
- Never use more than 3 accent colors on one screen.
- Status colors are ONLY for status badges, gate results, alerts — not decoration.
- Maintain 4.5:1 contrast ratio for all text (WCAG AA).

### 2.2 Typography

Font: **Inter** (Google Fonts or local), with system-ui fallback.

```
--text-xs:   11px / 1.4 / weight 400   /* Metadata, timestamps */
--text-sm:   13px / 1.5 / weight 400   /* Body, table content */
--text-base: 14px / 1.5 / weight 400   /* Default body */
--text-md:   15px / 1.5 / weight 500   /* Section headers, card titles */
--text-lg:   18px / 1.4 / weight 600   /* Page titles */
--text-xl:   24px / 1.3 / weight 700   /* Display numbers (metrics) */
--text-2xl:  32px / 1.2 / weight 700   /* Hero metric numbers */
```

**Rules:**
- Use Inter (or system-ui fallback). No Roboto, no custom fonts.
- Never mix more than 2 font weights in one component.
- Metric values MUST use `font-variant-numeric: tabular-nums` to prevent width shifting.

### 2.3 Spacing Grid

Base unit: **4px**. All spacing must be multiples of 4.

```
4px   — tight internal padding (icon gaps, badge padding)
8px   — component internal padding (small)
12px  — component internal padding (medium)
16px  — standard card padding, section spacing
24px  — between cards in a group
32px  — section-to-section spacing
48px  — page-level section breaks
```

Layout gutter between columns: 16px or 24px (never odd numbers).

### 2.4 Elevation

In dark mode, elevation is expressed via **background lightness**, not drop shadows:

```
Layer 1 (base):    #0F0F0F
Layer 2 (card):    #161616
Layer 3 (popover): #1E1E1E + border: 1px solid rgba(255,255,255,0.12)
Layer 4 (modal):   #242424 + backdrop: rgba(0,0,0,0.6)
```

Never use heavy box-shadow on dark backgrounds. Max: `box-shadow: 0 1px 3px rgba(0,0,0,0.4)`.

### 2.5 Border Radius

```
2px  — table rows, inline tags
4px  — input fields, small buttons
6px  — default buttons, badges, chips
8px  — cards, panels, dropdowns
12px — modals, large cards
16px — dashboard overview cards
```

Recommendation: **6px for interactive, 8px for containers**.

---

## 3. Core Component Specs

### 3.1 Sidebar Navigation

```
Width:         240px (expanded), 56px (collapsed)
Background:    --bg-surface (#161616)
Right border:  1px solid --border-subtle
Item height:   36px
Item padding:  0 12px
Active item:   bg --accent-subtle, text --text-primary, left indicator 2px --accent-primary
Hover item:    bg --bg-hover
Icon size:     16px, color --text-secondary (active: --accent-primary)
Section label: 11px, --text-disabled, uppercase, letter-spacing 0.06em
```

### 3.2 Kanban Board

```
Column width:     280px (min), scrollable horizontally
Column header:    Phase name (--text-md), count badge, gate status dot
Column bg:        --bg-surface
Card:             bg --bg-elevated, border --border-subtle, radius 6px, padding 12px
Card title:       --text-sm, --text-primary
Card metadata:    --text-xs, --text-secondary (assignee, age, label)
Drag handle:      visible on hover
Column gap:       12px
```

### 3.3 Metric Cards (DORA & Flow)

```
Layout:     2x2 or 4-column grid
Card:       bg --bg-surface, border --border-subtle, radius 8px, padding 20px
Label:      --text-xs, --text-secondary, uppercase
Value:      --text-2xl or --text-xl, tabular-nums, --text-primary
Trend:      --text-xs, colored with --status-success/danger
Sparkline:  optional, height 32px, color --accent-primary at 60% opacity
```

### 3.4 Quality Gate Badge

```
Pass:    bg #22C55E20, text #22C55E, border #22C55E40
Fail:    bg #EF444420, text #EF4444, border #EF444440
Warning: bg #F59E0B20, text #F59E0B, border #F59E0B40
Pending: bg #6B728020, text #6B7280, border #6B728040
Size:    padding 2px 8px, radius 4px, font 11px weight 500
```

### 3.5 Data Table

```
Header:       bg --bg-surface, --text-xs uppercase --text-secondary, border-bottom --border-default
Row height:   40px
Row hover:    --bg-hover
Row selected: --accent-subtle, left indicator 2px --accent-primary
Cell padding: 0 16px
Divider:      1px solid --border-subtle (horizontal only)
NEVER use vertical cell borders
```

### 3.6 Buttons

```
Primary:   bg --accent-primary, text white, hover --accent-hover, radius 6px, h 32px, px 12px
Secondary: bg transparent, border --border-default, text --text-primary, hover --bg-hover
Danger:    bg #EF444420, border #EF444440, text #EF4444, hover bg #EF444430
Icon-only: 32x32px, radius 6px, bg transparent, hover --bg-hover
```

---

## 4. Page Layout Patterns

### Dashboard Home

```
+----------+--------------------------------------------------+
|          |  Header: Project name + breadcrumb                |
| Sidebar  +--------------------------------------------------+
| 240px    |  Metric strip: 4 DORA cards (1 row)               |
|          +--------------------------------------------------+
|          |  Content area: 2 columns                          |
|          |  Left 60%: Kanban / workflow view                 |
|          |  Right 40%: Recent builds, gate status            |
+----------+--------------------------------------------------+
```

### Detail Page (Requirement / Incident / Retro)

```
+----------+--------------------------------+-------------+
|          |  Page header + actions         |             |
| Sidebar  +--------------------------------+  Right panel|
|          |  Main content / form           |  Metadata,  |
|          |  (readable width max 720px)    |  links,     |
|          |                                |  activity   |
+----------+--------------------------------+-------------+
```

---

## 5. Interaction & Motion

```
Hover transition:   background 120ms ease
Modal open:         opacity + translateY(4px) -> translateY(0), 150ms ease-out
Sidebar collapse:   width 240ms ease
Skeleton loading:   animated gradient, 1.5s linear infinite
Page transition:    fade 100ms (no slides)
```

- Never animate layout shifts or content reflow.
- Never use bounce or spring animations for business UI.

---

## 6. Dark/Light Mode

Start with **dark-only** for MVP (developer audience expects dark). Add light mode in v2 via CSS custom properties — all color tokens are variable-based so switching is a single class change on `<html>`.

---

## 7. Implementation Status

**Current state (2026-05-09):**

| Item | Status |
|---|---|
| Tailwind CSS v4 | Installed in `packages/frontend/` |
| Design tokens (CSS custom properties) | Defined in `packages/frontend/src/index.css` |
| shadcn/ui | NOT initialized — needs `npx shadcn@latest init` |
| Shared UI components | Partially exist in `packages/frontend/src/components/ui/` using inline styles |
| Component-to-token mapping | Components use inline `style={}` props instead of Tailwind classes or CSS variables |
| Font (Inter) | Configured via Google Fonts in index.css |

**Next step**: Phase 0 of the implementation plan — initialize shadcn/ui, rebuild shared components to use design tokens, and replace inline styles with Tailwind classes. See `implementation-plan.md`.

---

## 8. Reference Products

### Summary

| Product | Type | Key UI/UX to Learn | Access |
|---|---|---|---|
| **Linear** | Issue tracker | Sidebar, dashboard canvas, split-view | Free tier |
| **LinearB** | DORA + SDLC metrics | Cycle time breakdown, custom dashboard | Free trial |
| **Swarmia** | Engineering metrics | Team health, trend views | Free trial |
| **Faros AI** | DORA analytics | Tabbed dashboard, filter persistence | Demo |
| **Cortex.io** | Developer portal | Scorecard component, service view | Demo |
| **Apache DevLake** | SDLC data platform | Metric panel layout, grouping | Free / OSS |
| **Plane** | Issue tracker | Kanban + timeline + module | Free / OSS |

### SDLC Hub Screen → Reference Mapping

| SDLC Hub Screen | Learn From |
|---|---|
| Workflow Kanban Board | Linear (issue list), Plane (kanban), LinearB (phase breakdown) |
| DORA Metrics Dashboard | LinearB (team dashboard), Swarmia (trend view), Faros AI (tabbed layout) |
| Quality Gate Panel | Cortex.io (scorecard component) |
| Requirement Traceability | Backstage (entity detail panel layout) |
| Incident Tracking | Linear (issue detail split-view) |
| Retrospective Hub | Notion-like reading layout inside dark shell |
| Sidebar & Navigation | Linear (best-in-class for developer tools) |

### Recommended Viewing Order

1. **Linear** (free) — sign up, explore Dashboards, Issue detail, Kanban view
2. **Swarmia** (free trial) — explore Engineering Metrics dashboard and benchmark views
3. **Plane** (OSS) — clone and run locally, inspect the full UI flow
4. **LinearB** (demo) — schedule a demo, focus on Team Dashboard and DORA views
5. **Apache DevLake** (OSS) — run locally via Docker, study Grafana DORA panels
6. **Cortex.io** (demo) — request a demo, focus on Scorecard and service catalog views

---

## 9. Rules & Constraints

### Do's
- Use CSS custom properties for all colors, spacing, and radii
- Use `font-variant-numeric: tabular-nums` on all metric values
- Cap readable content width at 640–720px on forms and detail pages
- Use semantic color usage: status colors only for status, accent only for interactive elements

### Don'ts
- Never use white background for the main app shell in dark mode
- Never use gradient backgrounds on cards — flat is better for data tools
- Never put more than 3 chart types on one dashboard page
- Never use font sizes below 11px
- Never place two primary CTAs next to each other
- Never animate numbers on every render (flickers in dense dashboards)
- Never use border-radius > 12px on data tables or kanban cards
- Never use full-width forms on wide screens
