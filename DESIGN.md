---
version: alpha
name: DockerDash
description: Fleet monitoring dashboard for self-hosted Docker. Dark-first UI with cyan accent palette.
colors:
  background: "hsl(222 25% 6%)"
  foreground: "hsl(210 20% 95%)"
  primary: "hsl(190 80% 50%)"
  primary-foreground: "hsl(222 25% 6%)"
  secondary: "hsl(220 18% 14%)"
  secondary-foreground: "hsl(210 20% 90%)"
  muted: "hsl(220 18% 14%)"
  muted-foreground: "hsl(210 15% 60%)"
  destructive: "hsl(0 72% 51%)"
  destructive-foreground: "hsl(0 0% 100%)"
  warning: "hsl(38 92% 50%)"
  warning-foreground: "hsl(0 0% 100%)"
  success: "hsl(142 71% 45%)"
  success-foreground: "hsl(0 0% 100%)"
  border: "hsl(220 16% 16%)"
  ring: "hsl(190 80% 50%)"
  card: "hsl(220 20% 10%)"
  card-foreground: "hsl(210 20% 95%)"
  surface: "hsl(220 18% 12%)"
  surface-foreground: "hsl(210 20% 90%)"
  sidebar-background: "hsl(222 25% 5%)"
  sidebar-foreground: "hsl(210 15% 70%)"
  sidebar-primary: "hsl(190 80% 50%)"
  sidebar-accent: "hsl(220 18% 12%)"
  sidebar-accent-foreground: "hsl(210 20% 90%)"
  sidebar-border: "hsl(220 16% 14%)"
typography:
  body:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 0.875rem
  h1:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 1.5rem
    fontWeight: 700
  h2:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 1.25rem
    fontWeight: 600
  h3:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 0.875rem
    fontWeight: 600
  label-sm:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 0.625rem
    fontWeight: 700
    letterSpacing: 0.18em
  label-caps:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 0.6875rem
    fontWeight: 700
    letterSpacing: 0.2em
  mono:
    fontFamily: SF Mono, Fira Code, Cascadia Code, monospace
    fontSize: 0.6875rem
    fontWeight: 500
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: 8px 16px
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 8px
  card:
    backgroundColor: "{colors.card}"
    borderColor: hsla(220, 16%, 16%, 0.4)
    rounded: "{rounded.xl}"
  glass-card:
    backgroundColor: hsla(220, 20%, 10%, 0.6)
    borderColor: hsla(220, 16%, 16%, 0.5)
    rounded: "{rounded.xl}"
  input:
    backgroundColor: hsla(220, 18%, 14%, 0.4)
    borderColor: hsla(220, 16%, 16%, 0.5)
    rounded: "{rounded.lg}"
  badge:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
  table-header:
    backgroundColor: hsla(220, 18%, 14%, 0.2)
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-sm}"
  sidebar:
    backgroundColor: "{colors.sidebar-background}"
    textColor: "{colors.sidebar-foreground}"
    width: 224px
    collapsedWidth: 64px
  topbar:
    backgroundColor: hsla(220, 20%, 10%, 0.3)
    borderColor: "{colors.border}"
    height: 56px
---
## Overview

DockerDash is a fleet monitoring dashboard for self-hosted Docker environments. The UI follows a dark-first, cybernetic aesthetic — deep dark backgrounds with a bright cyan primary accent. The design language balances technical density with visual clarity: monospaced data points, glassmorphic cards, subtle grid backgrounds, and generous whitespace around critical metrics.

## Colors

The palette is HSL-based, using Tailwind's class-based dark mode (`.dark` class at the HTML level).

- **Primary (Cyan):** The sole interaction driver. Used for links, active states, toggles, and data visualization lines.
- **Destructive (Red):** Reserved for critical failure states, unhealthy hosts, stopped containers, and error alerts.
- **Warning (Amber):** Degraded states — stale hosts, high resource usage, partial telemetry.
- **Success (Green):** Healthy indicators, connected hosts, running containers, confirmed operations.
- **Surface:** Elevated backgrounds for cards, inputs, and secondary containers. Always slightly lighter than the page background.

### Light mode
The light palette mirrors the dark mode structure: white backgrounds, dark navy text, and the same cyan primary. The sidebar shifts to a near-white surface.

## Typography

- **Body:** Inter at 14px (0.875rem), the primary reading size throughout the dashboard.
- **Labels:** Tiny uppercase text with generous tracking (0.18–0.2em) for table headers, badges, and metadata.
- **Monospace:** Used for container IDs, log output, and technical identifiers. Stack prefers SF Mono on macOS.

## Layout

The authenticated app uses a three-zone layout:
1. **Sidebar** (224px, collapsible to 64px) — persistent navigation with icon + label groups
2. **Top bar** (56px, sticky) — org switcher, search (⌘K), notifications, theme toggle, user menu
3. **Content area** — scrollable page content with consistent spacing

### Mobile
On screens below 768px (`md:` breakpoint), the sidebar is replaced by a slide-over Sheet triggered by a hamburger icon in the top bar. The search bar collapses to an icon button. Content uses `p-3` padding.

### Page patterns
- **Headers:** Always include a PageHeader with title, description, and breadcrumbs
- **KPI grids:** Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` patterns
- **Data tables:** Horizontally scrollable with `min-w-[520px]`; critical columns visible on all breakpoints
- **Cards:** Glassmorphic (`bg-card/60 backdrop-blur-sm`) with subtle borders and rounded corners

## Elevation & Depth

The UI uses minimal elevation — the glass-card pattern provides depth through backdrop blur and semi-transparency rather than box shadows. Overlays (dialogs, sheets, drawers) use higher backdrop blur values with darkened overlay backgrounds.

## Shapes

- **Cards:** 16px (`rounded-xl`) for full cards, 12px for chart containers
- **Buttons:** 12px (`rounded-lg`) for standard buttons, 8px for icon-only buttons
- **Badges/Pills:** `rounded-full` for all pill-shaped elements
- **Inputs:** 8px (`rounded-lg`) for text inputs and selects

## Components

### Sidebar
Navigation panel with collapsible groups. Each group has a label and icon items. Active state uses `bg-sidebar-accent`. Premium features show a lock icon when not entitled.

### Top Bar
Sticky header with four sections: mobile nav trigger + org switcher (left), command palette search (center on desktop), notifications + theme + user menu (right). On mobile, search becomes an icon button.

### KPI Card
Compact metric card with status dot, label, value, optional trend indicator, and optional icon. Used in grids across dashboard pages. Heights are flexible — `min-h-[120px]`.

### Data Tables
Consistent table structure: sticky header with uppercase tracking labels, hover states on rows, horizontally scrollable on mobile. Action buttons are always visible on mobile (not hover-revealed).

### PageHeader
Consistent top-of-page component with title, description, breadcrumbs, and optional action buttons. No bottom margin — page spacing is handled by the parent `space-y-6`.

## Do's and Don'ts

- **DO** use `animate-fade-in` on page containers for entry transitions
- **DO** use `tabular-nums` for all numeric data display
- **DO** make action buttons always visible on mobile (never `opacity-0 group-hover:opacity-100`)
- **DO** use `glass-card` class for card containers in the dashboard
- **DON'T** use `h-screen` on mobile — use `min-h-dvh` instead
- **DON'T** hide critical data behind `lg:` or `xl:` breakpoints — mobile users need context too
- **DON'T** use fixed heights on card containers — use `min-h` instead
