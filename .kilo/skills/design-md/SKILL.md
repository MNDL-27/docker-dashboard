# Skill: design-md

Generate a DESIGN.md file for any project following the [Google DESIGN.md format specification](https://github.com/google-labs-code/design.md). DESIGN.md is a structured design system document with YAML front matter (machine-readable design tokens) and markdown prose (human-readable design rationale) that gives coding agents a persistent, structured understanding of a project's visual identity.

## When to use

Use this skill when the user asks to:
- Create or generate a DESIGN.md
- Document their project's design system
- Extract design tokens from an existing codebase
- Set up a DESIGN.md for agent-driven UI consistency
- Run `/design-md` command

## DESIGN.md Format Specification (Condensed)

A DESIGN.md file has two layers:

1. **YAML front matter** — Machine-readable design tokens, delimited by `---` fences at the top of the file.
2. **Markdown body** — Human-readable design rationale organized into `##` sections.

### Token Schema

```yaml
version: <string>          # optional, current: "alpha"
name: <string>
description: <string>      # optional
colors:
  <token-name>: <Color>    # hex format: "#1A1C1E"
typography:
  <token-name>: <Typography>
    fontFamily: <string>
    fontSize: <Dimension>    # e.g., "48px", "1rem"
    fontWeight: <number>     # e.g., 400, 600, 700
    lineHeight: <Dimension | number>
    letterSpacing: <Dimension>
    fontFeature: <string>    # optional
    fontVariation: <string>  # optional
rounded:
  <scale-level>: <Dimension>  # e.g., sm: 4px, md: 8px
spacing:
  <scale-level>: <Dimension | number>  # e.g., sm: 8px, md: 16px
components:
  <component-name>:
    backgroundColor: <Color | token reference>
    textColor: <Color | token reference>
    typography: <Typography | token reference>
    rounded: <Dimension | token reference>
    padding: <Dimension>
    size: <Dimension>
    height: <Dimension>
    width: <Dimension>
```

Token references use `{path.to.token}` syntax (e.g., `{colors.primary}`, `{rounded.md}`).

### Mandatory Section Order

Sections use `##` headings and must appear in this order (omit irrelevant ones):

1. **Overview** (alias: Brand & Style)
2. **Colors**
3. **Typography**
4. **Layout** (alias: Layout & Spacing)
5. **Elevation & Depth** (alias: Elevation)
6. **Shapes**
7. **Components**
8. **Do's and Don'ts**

### Recommended Token Names (Non-Normative)

- **Colors:** `primary`, `secondary`, `tertiary`, `neutral`, `surface`, `on-surface`, `error`
- **Typography:** `headline-display`, `headline-lg`, `headline-md`, `body-lg`, `body-md`, `body-sm`, `label-lg`, `label-md`, `label-sm`
- **Rounded:** `none`, `sm`, `md`, `lg`, `xl`, `full`

## Pre-Flight Checklist

Before starting, verify:
- [ ] You have read access to the project root and source directories
- [ ] `package.json` exists and is readable
- [ ] Identify the UI framework/CSS approach (Tailwind, shadcn/ui, CSS Modules, styled-components, etc.)
- [ ] Check if DESIGN.md already exists — if so, decide: regenerate vs. merge?
- [ ] On Windows: if you'll run npm commands, have npm available (test: `cmd /c npm --version`)

## Generation Workflow

Follow these steps in order. Do not skip steps.

### Step 1 — Scan the project for existing design system artifacts

**Search Strategy by Framework Type:**

- **Tailwind + shadcn/ui** (Most common)
  - Read `tailwind.config.ts` or `tailwind.config.js` — extract colors, spacing, borderRadius, extend blocks
  - Read `src/index.css` or `app/globals.css` — look for CSS variable definitions in `:root` block
  - Extract shadcn/ui color token patterns (usually HSL-based CSS custom properties)
  - Scan `src/components/ui/*.tsx` for component variant patterns

- **Pure CSS Variables** (no Tailwind)
  - Find root CSS files with `:root` or `@theme` blocks
  - Extract all custom property definitions (`--primary`, `--surface`, etc.)
  - Look for light/dark theme variants (`:root` vs `.dark :root`)

- **CSS-in-JS** (styled-components, emotion, etc.)
  - Search for theme/config files (often `theme.ts`, `theme.js`, `theme.config.ts`)
  - Extract color objects, spacing scales, typography configs
  - Look for styled component variant patterns

- **Material UI or other component libraries**
  - Read `theme.ts` or theme configuration files
  - Extract palette, typography, spacing, shape configurations

**Common Token Files to Check (in parallel):**
- `tailwind.config.{ts,js}`
- `src/index.css`, `app/globals.css`, `src/globals.css`
- `theme.{ts,js}`, `theme.config.{ts,js}`, `tokens.{ts,js}`
- `src/styles/{theme,tokens,variables}.{ts,js,css}`
- Component files with inline style patterns: `src/components/Button`, `src/components/Card`, etc.
- `@font-face` declarations and Google Fonts imports
- `package.json` — note UI framework versions and custom packages

**Additional Token Categories** (often overlooked):
- **Shadows:** Extract box-shadow values from component styles or Tailwind `boxShadow` config
- **Animations:** Extract keyframe definitions from CSS or Tailwind `animation` config
- **Gradients:** Extract gradient patterns used in backgrounds or component states
- **Opacity/Alpha:** Check for distinct opacity levels (e.g., `opacity-50`, `rgba(x, x, x, 0.5)`)
- **Transitions:** Extract duration and easing values (`transition-fast`, `duration-200ms`, etc.)

Use Grep and Read tools to gather all of these in parallel. For TypeScript configs, read line ranges that contain configuration objects to avoid reading entire files.

### Step 2 — Convert extracted values to DESIGN.md tokens

**Colors: Conversion Strategy**

Convert all color values to hex format (`#RRGGBB`). Handle each format:

- **Hex already** — Use as-is (e.g., `#15a4c1`)
- **RGB/RGBA** — Convert to hex; if alpha < 1.0, create a separate opacity token or suffixed variant (e.g., `primary-50`, `primary-transparent`)
  - `rgb(21, 164, 193)` → `#15a4c1`
  - `rgba(21, 164, 193, 0.5)` → token `primary` + separate opacity token `opacity-50: "0.5"`
- **HSL** — Convert to hex using the formula below
  - If CSS custom property like `hsl(var(--primary))`, resolve the variable value from `:root` first
  - `hsl(190, 80%, 42%)` → `#15a4c1`
- **Named CSS colors** — Look up standard values (e.g., `blue` → `#0000ff`), but prefer explicit token names
- **Gradients** — For complex linear/radial gradients, store as a descriptive token or reference primitive colors; document in prose
  - E.g., `gradient-primary: "linear-gradient({colors.primary}, {colors.primary-dark})"` (if DESIGN.md supports it) or in prose

**HSL to Hex Conversion (Reference):**
```javascript
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
```

**Color Token Naming & Organization:**

- **Semantic names** (primary, secondary, destructive, warning, success) map to their functional roles
- **Foreground/background pairs** (e.g., `primary` + `primary-foreground`) enable contrast-safe combinations
- **Tonal variants** (e.g., `primary`, `primary-light`, `primary-dark` OR `primary-50`, `primary-100`, ..., `primary-900`) for light/dark themes or tint scales
- **Light/dark theme splits:** If two distinct themes, use primary tokens for light theme, then add suffixes (e.g., `primary-dark`, `surface-dark`) or separate the theme entirely
- **Do NOT duplicate literal values** — use token references instead

**Typography: Extraction & Scaling**

Extract font families, sizes, weights, line heights, letter spacing:

- **Font families:** Identify all unique fonts used (e.g., Inter, Playfair Display). Note their purpose (headlines, body, code).
- **Scale levels:** Identify if the project uses a defined scale (8pt, 12pt, 16pt, 24pt, 32px, etc.) and map to semantic names:
  - Headlines: `headline-display`, `headline-lg`, `headline-md`, `headline-sm`
  - Body: `body-lg`, `body-md`, `body-sm`
  - Labels: `label-lg`, `label-md`, `label-sm`
- **Units:** Convert rem to px if needed (1rem = 16px), or keep rem — DESIGN.md supports both. Be consistent within each token.
- **Weight usage:** Document why specific weights are used (e.g., 700 for headlines, 500 for buttons, 400 for body).
- **Line height:** Extract as a multiple (e.g., 1.5) or pixel value (e.g., 24px). For consistency with font sizing, use the same unit.

**Rounded (Border Radius): Mapping to Scale**

Map border radius values to semantic levels:
- `sm`: 4px–6px (small, subtle rounding)
- `md`: 8px (default, Tailwind standard)
- `lg`: 12px–16px (prominent, card-like)
- `xl`: 20px–24px (large, button-like)
- `full`: 9999px (pill-shaped, fully rounded)

If project uses calc() or variable-based values, resolve them to concrete pixel values.

**Spacing: Scale Extraction**

Extract spacing scale from Tailwind config or CSS variables:
- Identify the base unit (usually 4px, 8px, or 16px)
- Create token names for common intervals: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
- Document semantic names: `container-padding`, `section-margin`, `element-gap`, `inset-spacing`, etc.
- Consistency check: All spacing tokens should use the same unit system.

**Shadows: Token Creation**

Extract box-shadow values and group by semantic intent:
- `shadow-sm`: Subtle elevation for floating elements
- `shadow-md`: Default elevation for cards
- `shadow-lg`: High elevation for modals, popovers
- `shadow-inset`: Inset shadows for wells or sunken elements

Store as complete shadow strings, e.g., `shadow-md: "0 4px 12px rgba(0, 0, 0, 0.1)"`.

**Animations & Transitions**

If the project uses animations or transitions, create tokens for:
- `duration-fast`: 100–150ms (interactive feedback)
- `duration-normal`: 200–300ms (typical transitions)
- `duration-slow`: 400–600ms (prominent animations)
- Easing: `ease-in`, `ease-out`, `ease-in-out` (or `cubic-bezier()` values)

Store as CSS transition/animation values, e.g., `duration-normal: "200ms"`, `easing-ease-in-out: "cubic-bezier(0.4, 0, 0.2, 1)"`.

**Component Tokens: Decision Framework**

For each UI component (buttons, cards, inputs, badges), decide:

**Include component tokens if:**
- The component has a distinct visual style that's used consistently across the project
- It has multiple states (default, hover, active, disabled) with predictable style changes
- The combination of color + typography + spacing + rounded forms a recognizable pattern

**Exclude component tokens if:**
- The component's style is trivial (e.g., a div with just a background color) — reference primitive tokens instead
- The component is context-dependent and doesn't have a universal style

**For each component token, include:**
- `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `border` (if applicable)
- Variant entries for hover/active/disabled states (e.g., `button-primary-hover`, `button-primary-disabled`)
- Token references (e.g., `{colors.primary}`, `{typography.body-md}`) instead of literal values

**Shadow & Opacity Token Inclusion**

If extracted:
- Add `boxShadow` (or similar) to component tokens as needed
- Define opacity scale tokens (e.g., `opacity-10`, `opacity-20`, ..., `opacity-90`) separately in the YAML (under `opacity:` section) if used frequently
- Reference in component states: `button-primary-hover: { backgroundColor: "{colors.primary}", opacity: "{opacity-90}" }` (if spec supports it)

### Step 3 — Write prose sections

For each section, write human-readable rationale that explains **WHY** the design choices exist and **HOW** to apply them. This is the most important part — agents need context, not just values.

**Prose Writing Guidelines**

Each section should:
1. Open with 1-2 sentences establishing the design principle or goal
2. Provide concrete examples: "Use [color] for [situation because]"
3. Include guardrails: "Never use [token] for [wrong context]"
4. Be concise but specific — avoid generic design speak

**Section-by-Section Guidance:**

**Overview** (1-2 paragraphs)
- Describe the brand personality: Is it modern & minimal? Warm & approachable? Technical & precise?
- Who is the target audience and what emotional response should the UI evoke?
- What is the visual metaphor or inspiration? (e.g., "Dashboard for infrastructure ops — clarity, trust, efficiency")
- Briefly reference the design system's scope (what it covers, what it doesn't)

Example:
```
## Overview
Watchtower is a real-time monitoring dashboard for Docker infrastructure. 
The design emphasizes **clarity over decoration** — every visual element serves 
a functional purpose. Colors are bold and purposeful (cyan for alerts, red for errors), 
allowing operators to scan dashboards quickly and respond to issues with confidence. 
Typography favors readability over beauty, with generous line spacing and high contrast.
```

**Colors** (1-2 paragraphs per color family)
- Explain the semantic role: "Primary is used for call-to-action buttons and navigation highlights"
- Document when/where each color appears: "Use destructive only for irreversible actions (delete, reset)"
- Call out contrast pairings: "primary text must be paired with primary-foreground background"
- For light/dark themes, explain the rationale: "Dark theme uses a lighter primary to maintain visual pop in low-light environments"

Example:
```
## Colors

**Primary (Cyan #15a4c1)** — The main interaction color for buttons, links, and highlights. 
Used to draw attention to the most important actions on a screen. Pairs with white for maximum contrast. 
In dark mode, primary becomes lighter (#19c4e6) to maintain visual distinction against dark backgrounds.

**Destructive (Red #dc2828)** — Reserved exclusively for actions that cannot be undone 
(delete container, reset cluster). Never use for passive warnings — use warning instead.
```

**Typography** (1 paragraph intro + subsections)
- Explain the font pairing strategy: "Headlines use Playfair (serif, authoritative) while body uses Inter (sans, readable)"
- Document hierarchy rules: "Every screen must have one H1-level headline, which uses headline-lg"
- Explain sizing progression: "Sizes follow a consistent scale from 12px (label-sm) to 48px (headline-display)"
- Note weight usage: "700 weight reserved for headlines; 600 for emphasis within body text; 400 for normal body"

Example:
```
## Typography

All typography uses two font families: **Inter** (body, labels, UI) and **Playfair Display** (headlines, emphasis).

**Headlines** use Playfair Display at 32px/700 weight for primary section titles (headline-lg), 
24px/700 for subsection headers (headline-md), and 20px/700 for component titles (headline-sm).

**Body text** uses Inter at 16px/400 with 1.5 line height, creating scannable paragraphs. 
Use body-sm (14px) sparingly for captions or metadata.
```

**Layout** (1-2 paragraphs)
- Describe the grid/container model: "12-column grid, 2rem max-width, 1.5rem gutters"
- Explain spacing rhythm: "All spacing uses multiples of 8px (xs: 8px, sm: 16px, md: 24px, lg: 32px)"
- Document common layouts: "Cards use md padding (24px) with lg gaps (32px) between sections"

Example:
```
## Layout

The dashboard uses a flexible grid layout with consistent 8px spacing units. 
Container max-width is 1440px on desktop, full-width on mobile. 
Padding follows the spacing scale: sections use lg (32px), cards use md (24px), 
internal element gaps use sm (16px).

All spacing is anchored to multiples of 8px for vertical rhythm consistency.
```

**Elevation & Depth** (1-2 paragraphs)
- Explain how visual hierarchy is conveyed: "Shadows indicate depth; higher z-index elements have stronger shadows"
- Document shadow levels: "Cards use shadow-md by default; modals use shadow-lg; floating buttons use shadow-sm"
- For non-shadow designs: "Depth is conveyed via tonal layers and borders; primary background is lightest, secondary is mid-tone, tertiary is darkest"

Example:
```
## Elevation & Depth

The dashboard uses shadows to indicate interactive depth. Cards and dropdowns use shadow-md (0 4px 12px rgba(0,0,0,0.1)) 
by default. Modals and top-level popovers use shadow-lg (0 12px 32px rgba(0,0,0,0.15)). 
Floating action buttons use subtle shadow-sm (0 2px 4px rgba(0,0,0,0.05)) to keep them lightweight.

In dark mode, shadows use slightly higher opacity to maintain contrast.
```

**Shapes** (1 paragraph)
- Describe the shape language: "Rounded corners convey friendliness; sharp edges convey precision"
- When rounded vs. sharp: "Buttons and cards are rounded (lg: 12px); tables and code blocks are sharp (sm: 4px)"

Example:
```
## Shapes

The design system favors subtle rounding: most UI elements use md (8px). 
Cards and buttons use lg (12px) for a softer, more approachable feel. 
Data tables and code blocks use sm (4px) to emphasize their structured, precise nature. 
Fully rounded (full: 9999px) is reserved for circular avatars and badge pills.
```

**Components** (1-2 paragraphs per component family)
- Explain component purpose and usage: "Buttons trigger actions; they must have a clear label"
- Document variant patterns: "Primary buttons are for preferred actions; secondary for alternative actions; tertiary for low-priority"
- State changes: "Hover darkens the button by 10%; disabled reduces opacity to 50%"

Example:
```
## Components

**Buttons** come in three variants: primary (main action), secondary (alternative), tertiary (low priority). 
All use headline font weight and padding md (24px). Hover state darkens the background by 10%. 
Disabled state reduces opacity to 50% and removes pointer events. 
Loading state replaces text with a spinner and disables interaction.

**Cards** hold related content and use padding-md (24px) internally, with gap-lg (32px) between sections. 
Borders are subtle (1px solid border-color); shadows are medium (shadow-md). 
Cards always have a rounded-lg corner (12px).
```

**Do's and Don'ts** (Bullet list, ~5-10 items)
- Practical guardrails based on the project's design philosophy
- "Do use semantic color names for accessibility"
- "Don't use colors purely decoratively"

Example:
```
## Do's and Don'ts

- **Do** use primary color for the most important action on a screen
- **Do** ensure text contrast ratios meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- **Do** use spacing-md as the default gap between sections; increase for breathing room if needed
- **Don't** use color alone to convey status — always pair with text or icons
- **Don't** mix rounded styles; if a section uses rounded-lg, all cards in it should too
- **Don't** use more than two font families on a single page
```

**Prose Quality Check:**
- Can an agent read this and understand WHY to use each token (not just WHAT the token is)?
- Are there concrete, unambiguous usage examples?
- Would a new developer understand the design philosophy without seeing code?

### Step 4 — Assemble the DESIGN.md file

**Handling existing DESIGN.md:**
- If DESIGN.md already exists, compare the extracted tokens with the existing version
- Preserve manually-written prose sections (Overview, Do's & Don'ts) unless they conflict with extracted tokens
- Update YAML front matter with newly extracted tokens, preserving semantic naming if consistent
- Document in git commit message: "Update DESIGN.md: merged extracted tokens with existing prose"

**File Assembly Checklist:**
1. Create or update `DESIGN.md` at the project root
2. YAML front matter:
   - Begins with `---` on its own line
   - Ends with `---` on its own line
   - Contains valid YAML (check: no trailing commas, proper indentation, quoted strings where needed)
3. Markdown body:
   - Uses `##` headings (no `#` single-hash headings)
   - Sections appear in the correct order (Overview → Colors → Typography → Layout → Elevation & Depth → Shapes → Components → Do's and Don'ts)
   - Prose is substantive, not just token listings
4. Token references:
   - All `{token.path}` references are valid (e.g., `{colors.primary}` resolves to a defined token)
   - No circular references

**Windows Considerations:**
- File encoding should be UTF-8
- Use forward slashes in any file paths (git-style)
- If editing via PowerShell, ensure output is UTF-8 (PowerShell may default to UTF-16LE)

### Step 5 — Validate with the Google DESIGN.md linter

**Windows Command Execution Note:**
On Windows, use `cmd /c npm ...` or `npx ...` commands directly. PowerShell execution policy may block npm scripts.

**Linter Installation & Validation:**

Check if `@google/design.md` is available:
```bash
npx @google/design.md --version
```

If available, lint the file:
```bash
# Recommended: via npm script in package.json
npm run design:lint

# Or direct npx call
npx @google/design.md lint DESIGN.md
```

**Interpreting Linter Output:**

| Error Type | Fix Action |
|---|---|
| `Token reference "{x.y.z}" not found` | Verify the token path exists in YAML front matter; check spelling |
| `Duplicate section heading` | Ensure each section appears only once; check section names |
| `Invalid color format` | Verify hex values are `#RRGGBB` format (6 hex digits + #) |
| `Missing required field in token` | Typography tokens must have `fontFamily` and `fontSize` at minimum |
| `YAML parse error` | Check for trailing commas, missing colons, inconsistent indentation |

**If Linter Reports Warnings (non-critical):**
- Consider fixing but do not block on them
- Common warnings: unused tokens, overly-verbose descriptions

**If Linter is Unavailable:**

Manually verify these points:
- [ ] YAML is valid: no syntax errors, proper indentation, quotes where needed
- [ ] All `{token.path}` references in markdown resolve to actual tokens in front matter
- [ ] No duplicate section headings
- [ ] Sections appear in correct order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts)
- [ ] All color values are valid hex (`#RRGGBB` or `#RRGGBBAA`)
- [ ] Typography tokens have at minimum: `fontFamily`, `fontSize`
- [ ] No dangling colons or commas in YAML
- [ ] Markdown body does not contain bare `---` lines that might break the front matter fence

### Step 6 — Completion Quality Checklist

Before declaring the DESIGN.md complete, verify:

**Tokens & Format:**
- [ ] YAML front matter is valid and lints successfully (or passes manual checks)
- [ ] All color tokens are in hex format (`#RRGGBB`)
- [ ] Typography tokens include `fontFamily` and `fontSize` at minimum
- [ ] Rounded tokens are concrete px values (no calc() or variables)
- [ ] All `{token.path}` references in prose are resolvable

**Prose Quality:**
- [ ] Overview section describes brand personality and design philosophy (not just a feature list)
- [ ] Each color section explains WHERE and WHY to use it (not just the hex value)
- [ ] Typography section explains font pairing strategy and hierarchy rules
- [ ] Layout section documents spacing rhythm and grid model
- [ ] Components section includes at least 3-5 key UI components with their design intent
- [ ] Do's and Don'ts section has at least 5 concrete guardrails
- [ ] Prose is agent-friendly: no jargon; clear examples; actionable guidance

**Extraction Completeness:**
- [ ] All UI framework colors extracted (light + dark themes if applicable)
- [ ] All typography levels represented (headlines, body, labels)
- [ ] Common component patterns documented (buttons, cards, inputs at minimum)
- [ ] Spacing scale is complete and consistent
- [ ] Shadows/animations/elevations included if used in the project

**Files Scanned** (Document these):
- [ ] `tailwind.config.ts` ✓ (or N/A)
- [ ] `src/index.css` or `app/globals.css` ✓ (or N/A)
- [ ] Component files: `src/components/Button.tsx`, `src/components/Card.tsx`, etc. ✓ (or N/A)
- [ ] `package.json` for UI framework context ✓
- [ ] Theme/token files: `theme.ts`, `tokens.ts`, etc. ✓ (or N/A)

### Step 7 — Optional: Export Tokens & Document Decisions

**Export Tokens (if applicable):**

If the project uses Tailwind or needs token exports:

```bash
# Export to Tailwind config
npx @google/design.md export --format css-tailwind DESIGN.md > theme.css

# Export to JSON (W3C DTCG format)
npx @google/design.md export --format dtcg DESIGN.md > tokens.json
```

**Optional: Update Project Memory**

If your project uses a shared knowledge base (Notion, GitHub wiki, etc.):
1. Link to the new DESIGN.md in the project's design documentation
2. Note any significant design decisions or naming conventions used
3. Record which files were scanned and which tokens were extracted
4. Link related documents (component library, design guidelines, brand guidelines)

If no shared knowledge base exists, skip this step.

**Optional: Git Integration**

Consider adding a git hook or commit message template:
```bash
# Commit message example
git add DESIGN.md
git commit -m "Add DESIGN.md: design system tokens and rationale"
```

Or in package.json, add a script to validate DESIGN.md on commit:
```json
{
  "scripts": {
    "design:validate": "npx @google/design.md lint DESIGN.md || true"
  }
}
```

## Example Output Structure

```markdown
---
version: alpha
name: Watchtower Dashboard
colors:
  primary: "#15a4c1"
  primary-foreground: "#ffffff"
  secondary: "#f3f4f6"
  secondary-foreground: "#0f1729"
  ...
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 40px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 6px
  md: 8px
  lg: 8px
  # Note: The project's Tailwind config uses calc() for rounded (e.g., calc(var(--radius) - 2px)).
  # DESIGN.md spec defines Dimension as "number + unit" — calc() is not a valid Dimension.
  # Resolve calc() to concrete pixel values for the DESIGN.md tokens.
spacing:
  container-padding: 2rem
  card-gap: 1.5rem
  section-margin: 2rem
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  card-standard:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
---

## Overview
[Brand description, personality, emotional goals]

## Colors
[Color rationale with descriptive names and usage rules]

## Typography
[Font strategy, hierarchy rules, weight usage]

## Layout
[Grid model, spacing rhythm, container strategy]

## Elevation & Depth
[Shadow strategy, glass effects, tonal layers]

## Shapes
[Shape language, when rounded vs sharp]

## Components
[Component design intent and interaction patterns]

## Do's and Don'ts
[Practical guardrails]
```

## HSL to Hex Conversion Reference

For projects using CSS custom properties with HSL values (common in shadcn/ui projects):

```javascript
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
```

Common conversions for this project's theme (verified via hslToHex function):

| CSS Variable | HSL Value | Hex (Light) | Hex (Dark) |
|---|---|---|---|
| --primary | 190 80% 42% / 190 80% 50% | #15a4c1 | #19c4e6 |
| --background | 0 0% 100% / 222 25% 6% | #ffffff | #0b0e13 |
| --foreground | 222 47% 11% / 210 20% 95% | #0f1729 | #f0f2f5 |
| --card | 0 0% 100% / 220 20% 10% | #ffffff | #14181f |
| --secondary | 220 14% 96% / 220 18% 14% | #f3f4f6 | #1d222a |
| --destructive | 0 72% 51% | #dc2828 | #dc2828 |
| --warning | 38 92% 50% | #f59f0a | #f59f0a |
| --success | 142 71% 45% | #21c45d | #21c45d |
| --muted | 220 14% 96% / 220 18% 14% | #f3f4f6 | #1d222a |
| --border | 220 13% 91% / 220 16% 16% | #e5e7eb | #22272f |
| --ring | 190 80% 42% / 190 80% 50% | #15a4c1 | #19c4e6 |
| --surface | 220 14% 96% / 220 18% 12% | #f3f4f6 | #191d24 |

## Common Issues & Recovery

**Issue: Color tokens can't be extracted uniformly**
- *Problem:* Colors are scattered across multiple files with no consistent naming
- *Solution:* Group colors by semantic role (primary, destructive, warning, etc.) rather than technical source. Create a mapping document first, then build tokens from it.

**Issue: Some files have calc() for spacing or rounding**
- *Problem:* `calc(var(--radius) - 2px)` can't be converted to a single px value
- *Solution:* Compute the final value with a concrete example. Add a comment in DESIGN.md explaining the resolution. E.g., `# Resolved from calc(var(--radius) - 2px) where --radius = 8px`

**Issue: Design rationale is missing or unclear**
- *Problem:* Can't explain WHY a design choice was made; prose section is empty
- *Solution:* Infer from code patterns or context. Ask: "What problem does this design solve?" E.g., if primary color is cyan, ask "Why cyan?" (visibility in dark interfaces, brand identity, etc.)

**Issue: DESIGN.md already exists with different structure**
- *Problem:* Existing file doesn't follow Google DESIGN.md spec or uses different naming
- *Solution:* Preserve existing prose sections (Overview, Do's & Don'ts). Update YAML front matter to match spec. Add a comment: "Last updated [date] with extracted tokens"

**Issue: Typography scale doesn't fit the semantic names**
- *Problem:* Project has 7 font sizes but only 3 semantic levels (headline, body, label)
- *Solution:* Create sub-levels: `headline-lg`, `headline-md`, `headline-sm`, or use numeric suffixes: `headline-1`, `headline-2`, `headline-3`

**Issue: Missing component patterns**
- *Problem:* Can't extract enough components to populate the Components section
- *Solution:* Focus on the 3-5 most commonly-used components (Button, Card, Input, Badge, Modal). Use those as the foundation; add others incrementally. Don't force tokens for trivial components.

**Issue: Linter fails with npm execution error on Windows**
- *Problem:* "npm is not recognized" or PowerShell execution policy blocks script
- *Solution:* Use `cmd /c npx @google/design.md lint DESIGN.md` or ensure npm is in PATH. If PowerShell issue persists, switch to cmd.exe terminal or use WSL2.

## Token Naming & Scope Decision Tree

**Q1: Should I create component tokens or just use primitives?**

```
Is this component used consistently across the project with the same visual style?
  ├─ YES → Does it have multiple interactive states (hover, active, disabled)?
  │         ├─ YES → Create component tokens (button-primary, button-primary-hover, etc.)
  │         └─ NO → Create a single component token (badge-info)
  │
  └─ NO → Use primitive tokens only (reference colors, typography, etc. directly)
           Example: A one-off modal with unique styling doesn't need a component token
```

**Q2: How granular should spacing tokens be?**

```
Does the project have a clear spacing scale in Tailwind or CSS?
  ├─ YES → Extract all scale levels (xs: 8px, sm: 16px, md: 24px, lg: 32px, xl: 48px)
  │         Include semantic names (container-padding: 2rem, section-gap: 1.5rem)
  │
  └─ NO → Create a basic 5-level scale: xs, sm, md, lg, xl
           Map to common values: 8px, 16px, 24px, 32px, 48px
```

**Q3: Should I include light and dark theme variants?**

```
Does the project support dark mode (CSS @media prefers-color-scheme or .dark class)?
  ├─ YES → Include primary tokens for light theme
  │         Add -dark suffixes for dark theme (primary-dark, surface-dark, etc.)
  │         OR create separate theme objects if spec allows
  │
  └─ NO → Include light theme tokens only
```

**Q4: Should I include all possible typography sizes or only semantic ones?**

```
Does the project have a defined typography scale (e.g., 12px, 14px, 16px, 18px, 20px, 24px, 32px)?
  ├─ YES → Map each to a semantic name (label-sm, body-sm, body-md, headline-sm, headline-lg, etc.)
  │         Create enough levels to cover all use cases (~6-8 levels is typical)
  │
  └─ NO → Create a minimal scale: 3-4 headline levels, 2-3 body levels, 2-3 label levels
```

## Notes on Spec & Tooling

- DESIGN.md format version is `alpha` — expect changes as the spec matures. Check the [Google DESIGN.md repo](https://github.com/google-labs-code/design.md) for updates.
- **shadcn/ui projects:** CSS custom properties with HSL are standard. Always resolve variables from `:root` and convert to hex.
- **YAML front matter:** Must be valid YAML. Quote fontWeight if it's a number (both `fontWeight: 400` and `fontWeight: "400"` are accepted).
- **Token references:** Use `{path.to.token}` syntax. Nested paths like `{colors.primary}` are common; verify the path matches the YAML structure.
- **Component variants:** Express as separate tokens with related names (e.g., `button-primary`, `button-primary-hover`, `button-primary-disabled`).
- **Shadows, animations, gradients:** While not explicitly in the schema, store as complete CSS values (e.g., `"0 4px 12px rgba(0,0,0,0.1)"`).
- **Windows considerations:** Use UTF-8 file encoding; forward slashes in paths; use `cmd /c npm ...` if PowerShell execution policy blocks scripts.

## References

- [Google DESIGN.md GitHub Repository](https://github.com/google-labs-code/design.md)
- [DESIGN.md Full Specification](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md)
- [DESIGN.md CLI Reference](https://github.com/google-labs-code/design.md#cli-reference)
- [Example: Atmospheric Glass](https://github.com/google-labs-code/design.md/tree/main/examples/atmospheric-glass)
- [Example: Paws & Paths](https://github.com/google-labs-code/design.md/tree/main/examples/paws-and-paths)
- [Example: Totality Festival](https://github.com/google-labs-code/design.md/tree/main/examples/totality-festival)