---
name: ZarifÇözüm
description: A warm, paper-toned visual system for mathematics learning.
colors:
  warm-cream: "#fbf1e8"
  ivory-paper: "#fffaf5"
  soft-sand: "#f3e1cf"
  secondary-surface: "#f8f6f0"
  homepage-surface: "#f8ebdd"
  cocoa-ink: "#3a2618"
  muted-cocoa: "#6a5242"
  chestnut-primary: "#7a4f2d"
  chestnut-hover: "#6b4a2f"
  chestnut-active: "#523520"
  accent-coral: "#D6452B"
  accent-coral-soft: "#FBE0D8"
  accent-coral-button: "#B73520"
  accent-emerald: "#17805F"
  accent-emerald-soft: "#D8F0E6"
  accent-cobalt: "#2F5FD0"
  accent-cobalt-soft: "#DCE6FA"
  feedback-correct: "#276B43"
  feedback-correct-soft: "#E0F0E5"
  feedback-incorrect: "#B93838"
  feedback-incorrect-soft: "#F8DEDE"
  soft-border: "#d9d3c3"
  warm-divider: "#ecd9c6"
typography:
  display:
    fontFamily: 'Georgia, "Playfair Display", "Times New Roman", serif'
    fontSize: "clamp(2.2rem, 1.4rem + 3.6vw, 4.2rem)"
    fontWeight: 700
    lineHeight: 1.08
  headline:
    fontFamily: "'Clash Display', 'General Sans', 'Helvetica Neue', sans-serif"
    fontSize: "clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "'General Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1rem, 0.95rem + 0.25vw, 1.125rem)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'General Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)"
    fontWeight: 600
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)"
    fontWeight: 500
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.875rem"
  xl: "1.25rem"
  full: "9999px"
  homepage-md: "0.9rem"
  homepage-lg: "1.1rem"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-5: "1.25rem"
  space-6: "1.5rem"
  space-8: "2rem"
  space-10: "2.5rem"
  space-12: "3rem"
  space-16: "4rem"
  space-20: "5rem"
  space-24: "6rem"
components:
  button-primary:
    backgroundColor: "var(--page-cta)"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.25rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, var(--page-cta) 90%, black)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.25rem"
    height: "44px"
  card-default:
    backgroundColor: "{colors.ivory-paper}"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  chip-default:
    backgroundColor: "var(--page-accent-soft)"
    textColor: "{colors.cocoa-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0.2rem 0.6rem"
  input-field:
    backgroundColor: "{colors.ivory-paper}"
    textColor: "{colors.cocoa-ink}"
    rounded: "8px"
    padding: "12px"
  site-nav:
    textColor: "{colors.muted-cocoa}"
    typography: "{typography.body}"
  notice-info:
    backgroundColor: "var(--page-accent-soft)"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
---

# Design System: ZarifÇözüm

## Overview

**Creative North Star: "Krem kâğıtlı matematik çalışma odası"**

ZarifÇözüm's interface pairs warm paper-like surfaces and cocoa headings with a role-based accent system. The intended feeling is warm, calm, and trustworthy: clear enough for study, with a quietly editorial character rather than a cold technology aesthetic. Keep the existing cream background, dark-brown headings, and ZarifÇözüm logo fixed.

The shared stylesheet and homepage have related but distinct implementations. Shared page display headings use Clash Display and a restrained chestnut palette; the homepage switches its headings to a Georgia-led serif, softens surfaces, and uses pill-shaped calls to action. Preserve those as observed surface variations rather than flattening them into one invented component style.

**Key Characteristics:**
- Warm cream and cocoa form the visual foundation.
- Serif display type and sans-serif reading text create the main hierarchy.
- Rounded controls, paper-toned cards, and soft ambient shadows keep the interface approachable.
- New work is mobile-first and favors clear, breathable layouts.

## Colors

The fixed foundation is warm cream, ivory, sand, cocoa, and chestnut. Accent colors are assigned by learning context, not mixed freely.

### Brand Foundation
- **Kestane Mürekkebi** (`{colors.chestnut-primary}`): Fixed dark-brown brand tone for headings and identity details.
- **Kestane Hover** (`{colors.chestnut-hover}`) and **Koyu Kestane** (`{colors.chestnut-active}`): Retain for existing chestnut-specific states; they are not additional page accents.

### Accent Roles
- **Mercan** (`{colors.accent-coral}`, soft `{colors.accent-coral-soft}`): Entry and primary CTA, home and registration flows, and grades 5–8.
- **Zümrüt** (`{colors.accent-emerald}`, soft `{colors.accent-emerald-soft}`): Progress, success states, test results, parent dashboard, and grades 9–12.
- **Kobalt** (`{colors.accent-cobalt}`, soft `{colors.accent-cobalt-soft}`): Learning assistant, lesson explanations, and live classes.

### Neutral
- **Sıcak Krem** (`{colors.warm-cream}`): Main page background.
- **Fildişi Kâğıt** (`{colors.ivory-paper}`): Cards and raised content surfaces.
- **Yumuşak Kum** (`{colors.soft-sand}`): Highlighted panels, chips, and secondary surface areas.
- **İkincil Yüzey** (`{colors.secondary-surface}`): Shared stylesheet's secondary neutral surface.
- **Ana Sayfa Yüzeyi** (`{colors.homepage-surface}`): Homepage-specific secondary surface.
- **Kakao Mürekkebi** (`{colors.cocoa-ink}`): Main text and dark brand details.
- **Soluk Kakao** (`{colors.muted-cocoa}`): Supporting copy and navigation.
- **Yumuşak Kenarlık** (`{colors.soft-border}`): Shared component outlines.
- **Sıcak Ayraç** (`{colors.warm-divider}`): Section and navigation separators.

**One accent per page.** A page selects one of coral, emerald, or cobalt, and uses that accent with its matching soft tone. The homepage is the sole exception: it may use all three, scoped to the roles above. Never recolor the cream foundation, cocoa headings, or logo.

Correct/incorrect answer feedback is independent of page accents and stays consistent everywhere: use `{colors.feedback-correct}` / `{colors.feedback-correct-soft}` for correct, and `{colors.feedback-incorrect}` / `{colors.feedback-incorrect-soft}` for incorrect. Do not derive answer feedback from `--page-accent`.

**CSS variable contract:** define the palette once, then set the page's accent with one `data-accent` value. Components consume `--page-accent`, `--page-accent-soft`, and `--page-cta`; the homepage may scope role-specific overrides to its sections.

```css
:root {
  --accent-coral: #D6452B;
  --accent-coral-soft: #FBE0D8;
  --accent-coral-button: #B73520;
  --accent-emerald: #17805F;
  --accent-emerald-soft: #D8F0E6;
  --accent-cobalt: #2F5FD0;
  --accent-cobalt-soft: #DCE6FA;
  --feedback-correct: #276B43;
  --feedback-correct-soft: #E0F0E5;
  --feedback-incorrect: #B93838;
  --feedback-incorrect-soft: #F8DEDE;
}

body[data-accent="coral"] {
  --page-accent: var(--accent-coral);
  --page-accent-soft: var(--accent-coral-soft);
  --page-cta: var(--accent-coral-button);
}
body[data-accent="emerald"] {
  --page-accent: var(--accent-emerald);
  --page-accent-soft: var(--accent-emerald-soft);
  --page-cta: var(--accent-emerald);
}
body[data-accent="cobalt"] {
  --page-accent: var(--accent-cobalt);
  --page-accent-soft: var(--accent-cobalt-soft);
  --page-cta: var(--accent-cobalt);
}
```

For example, switch a page with one line: `<body data-accent="emerald">`. White button text must meet at least 4.5:1 contrast. The supplied coral `#D6452B` is 4.43:1 against white, so coral buttons use the darker `#B73520` variant (5.93:1); emerald is 4.90:1 and cobalt is 5.72:1 with white.

**The Warm Paper Rule.** Keep the cream-and-cocoa identity recognizable across surfaces; distinguish page-specific token overrides instead of silently normalizing them.

## Typography

**Display Font:** Georgia (with Playfair Display and Times New Roman fallbacks on the homepage)
**Body Font:** General Sans (with Helvetica Neue and Arial fallbacks)
**Label/Mono Font:** General Sans for labels; JetBrains Mono for codes, figures, and tabular values

**Character:** Display typography is expressive and bookish; body copy stays modern and easy to scan. Fontshare and Google Fonts are declared by the pages, so the listed system fallbacks remain important when external font loading is unavailable.

### Hierarchy
- **Display** (700, responsive 2.2–4.2rem, 1.08 line-height): Homepage hero headlines; Georgia-led serif.
- **Headline** (600, responsive 1.5–2.25rem, 1.15 line-height): Shared page headings; Clash Display-led sans-serif.
- **Title** (600, responsive 1.125–1.5rem): Section and card headings.
- **Body** (400, responsive 1–1.125rem, 1.6 line-height): Main reading text; paragraphs generally remain within 68ch.
- **Label** (600, responsive 0.75–0.875rem): Chips, compact metadata, and helper labels.
- **Mono** (500, responsive 0.75–0.875rem): Curriculum codes, counts, and numerical readouts.

**The Two-Voice Rule.** Keep the serif homepage display and the shared Clash Display heading stack as distinct existing roles; do not apply the homepage override globally without an explicit redesign.

## Layout

The shared content container is capped at 1120px with fluid side gutters; the app shell uses a 248px sidebar on wide screens. Marketing heroes use a two-column layout that collapses to one column below 900px. Three- and four-column grids reduce to two columns below 900px and one column below 600px; the homepage benefit strip becomes two columns below 760px and stacks its item content on narrow phones.

Use the existing 4px-based spacing rhythm, from compact 4px and 8px gaps through 48px, 64px, 80px, and 96px section spacing. Prefer the named spacing tokens over one-off values. New surfaces should be designed mobile-first, with readable type and uncluttered controls before adding wider-screen density.

## Elevation & Depth

Depth is ambient rather than dramatic: the shared system uses restrained shadows on cards and devices, while the homepage warms and slightly strengthens those shadows. Tonal surface changes and fine borders do most of the structural work. Keep shadows soft and avoid hard, dark cast shadows.

### Shadow Vocabulary
- **Quiet surface** (`0 1px 2px oklch(0.3 0.03 150 / 0.06)`): Shared card resting state.
- **Lifted surface** (`0 6px 18px oklch(0.3 0.03 150 / 0.08)`): Shared emphasis and hover elevation.
- **Homepage resting card** (`0 1px 2px rgba(90, 55, 30, 0.08)`): Homepage tiles and cards.
- **Homepage lifted card** (`0 8px 22px rgba(90, 55, 30, 0.12)`): Homepage hover and focus elevation.

**The Quiet Depth Rule.** Use a soft shadow to clarify a surface or interaction state, never as a dark decorative effect.

## Shapes

Shared controls use compact rounded corners (6px small, 10px medium); cards and device panels use 14px and 20px radii. Chips are fully pill-shaped. The homepage increases medium and large corners to about 14px and 18px and makes its primary and ghost buttons pill-shaped. Registration fields use an 8px radius. Keep borders fine and warm; the homepage logo watermark and circular icon details are supporting motifs, not a reason to round every container.

## Components

### Buttons
- **Shape:** Shared buttons use a 10px radius; homepage CTA buttons use a pill silhouette.
- **Primary:** Page primary actions use `var(--page-cta)` with white text; the page's assigned accent provides the color.
- **Button contrast:** Coral uses the darker `#B73520` button variant for white labels; emerald and cobalt use their canonical colors.
- **Hover / Focus:** Darken the primary fill; use the global 2px focus outline with a 2px offset. Homepage cards and controls use a small lift where defined.
- **Secondary / Ghost:** Transparent fill with a fine warm border in the shared system; the homepage uses a softly tinted paper fill.
- **Sizing:** Shared default height is at least 44px; compact buttons may be 36px. Large buttons use the next spacing step.
- **Disabled:** Reduce opacity and remove the active cursor treatment.

### Chips
- **Style:** Compact pill labels on a sand or status-tinted background; use semantic status colors only for status.
- **State:** The live chip is the exception with a red live indicator and subtle pulse.

### Cards / Containers
- **Corner Style:** Shared cards use 14px corners; homepage cards are slightly softer.
- **Background:** Ivory or surface-offset paper tones with a fine border.
- **Shadow Strategy:** Resting cards use the quiet surface shadow; hoverable homepage tiles may lift slightly.
- **Internal Padding:** 20px for shared cards; feature cards use 24px.
- **Homepage class paths:** Two paper-toned cards sit immediately below the hero for grades 5–8 and 9–12. Each offers direct grade links with 44px minimum touch targets.
- **Class path accents:** The 5–8 path uses coral and the 9–12 path uses emerald, as the homepage-only multi-accent exception.

### Inputs / Fields
- **Style:** Registration fields use an ivory background, a 1px neutral border, 8px corners, and 12px padding.
- **Focus:** A warm 3px focus ring and chestnut border shift; preserve a visible keyboard focus state.
- **Error / Disabled:** Communicate these states semantically and keep their text readable; disabled form controls remain visibly inactive.

### Navigation
- **Style:** Sticky, lightly translucent header with a fine divider; brand mark and wordmark sit beside the page links.
- **Typography:** Sans-serif navigation with medium weight and muted cocoa color; hover shifts toward the main text color.
- **Mobile treatment:** Collapse the page links behind the menu control; keep account actions reachable in a horizontally scrollable row when present.

### Learning Carousel
- The homepage's learning-device panel is a signature presentation pattern: compact metric tiles, a progress bar, curriculum labels, a score ring, and a guided hint. Keep its information scannable and avoid turning the demo metrics into factual product claims.

## Do's and Don'ts

### Do:
- **Do** preserve the existing ZarifÇözüm logo and cream/chestnut identity.
- **Do** build new surfaces mobile-first and leave enough breathing room around learning content.
- **Do** use mathematics-themed hand-drawn illustrations such as rulers, set squares, and graph paper when useful.
- **Do** use subtle, purposeful animation and respect reduced-motion preferences.
- **Do** keep color variants and typography overrides scoped to the surfaces where the code currently uses them.

### Don't:
- **Don't** shift the product into a cold blue-purple technology aesthetic.
- **Don't** use hard dark shadows, neon colors, or crowded, high-density layouts.
- **Don't** use success, warning, error, or live colors as decorative substitutes for the warm brand palette.
- **Don't** flatten the homepage's serif and pill-button treatment into every shared page without an explicit redesign.
