---
name: Academic & Financial Student Companion
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#43474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777e'
  outline-variant: '#c3c6ce'
  surface-tint: '#49607c'
  primary: '#001428'
  on-primary: '#ffffff'
  primary-container: '#0f2942'
  on-primary-container: '#7991af'
  inverse-primary: '#b0c9e8'
  secondary: '#7d5800'
  on-secondary: '#ffffff'
  secondary-container: '#ffb702'
  on-secondary-container: '#6b4b00'
  tertiary: '#00122d'
  on-tertiary: '#ffffff'
  tertiary-container: '#08274e'
  on-tertiary-container: '#768fbb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#b0c9e8'
  on-primary-fixed: '#011d35'
  on-primary-fixed-variant: '#314863'
  secondary-fixed: '#ffdea9'
  secondary-fixed-dim: '#ffba27'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4100'
  tertiary-fixed: '#d6e3ff'
  tertiary-fixed-dim: '#aec7f7'
  on-tertiary-fixed: '#001b3d'
  on-tertiary-fixed-variant: '#2e476f'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for high schoolers and university students navigating the dual pressures of academic performance and personal budgeting. The design ethos fuses academic rigor with youthful dynamism: deliberate, trustworthy, yet energetic and encouraging.

The visual style embraces **Modern Tactile Minimalism** paired with soft contextual warmth. Crisp white canvases and calm off-white containers evoke organized desk spaces, while deep navy surfaces impart structural credibility and financial serenity. Energetic solar amber highlights celebrate progress, break down intimidation around money management, and highlight academic wins. Visual clutter is stripped away in favor of generous breathing room, smooth generous corners, and clean typographic cadence.

## Colors

The palette balances fiscal and academic seriousness against the vibrant enthusiasm of student life:

- **Primary (`#0F2942`)**: Deep Navy. Serves as the bedrock tone for key structural elements, active tabs, dark cards, critical typography, and primary interactive buttons.
- **Secondary (`#FFB703`)**: Solar Amber / Warm Gold. Reserved for actionable badges, achievement ribbons, grade alerts, budget streaks, and dynamic visual indicators.
- **Tertiary (`#1B365D`)**: Oxford Midnight. Delivers tonal contrast within elevated cards, navigation segments, and secondary structural accents.
- **Neutral (`#64748B`)**: Slate Gray. Drives body copy, subtle borders, inactive indicators, and supporting data labels.

Background surfaces rely on crisp `#FFFFFF` for hero elements and `#F8FAFC` for page scaffolding and card resting states. Functional tints include `#FEF08A` for soft amber status chips, `#DC2626` for financial overages or critical deadlines, and `#10B981` for completed goals and validated grades.

## Typography

Typography is set entirely in **Plus Jakarta Sans**, a modern geometric grotesque characterized by friendly open apertures, clear counters, and high-legibility numerals crucial for financial budgets and grade-point calculations.

- **Display & Headlines**: Heavy weights (`700` and `800`) with tight letter spacing establish clean visual landmarks on mobile dashboards.
- **Body Text**: Tuned to regular (`400`) and medium weights to ensure relaxed reading of course syllabi, transaction logs, and study reminders.
- **Labels & Badges**: Set in semibold and bold weights (`600` and `700`) with slight positive tracking to ensure instant scannability for numeric marks (e.g., `18.5/20`, `€142.50`) and status indicators.

## Layout & Spacing

The layout is built for fluid mobile-first ergonomics with seamless tablet adaptivity.

- **Mobile (<= 640px)**: A 4-column layout anchored by a `1rem` (`16px`) outer screen margin and a `0.75rem` (`12px`) gutter. Touch targets conform strictly to a 48px baseline height. Bottom navigation bars and primary call-to-action floating ribbons sit comfortably within thumb reach.
- **Tablet & Split-view (641px - 1024px)**: Transitions into an 8-column layout with `1.5rem` (`24px`) margins. Enables dual-pane views (e.g., semester schedule on the left, running ledger on the right).
- **Rhythm**: Internal card padding standardizes on `space-md` (`16px`) for sub-cards and `space-lg` (`24px`) for primary summary modules. Vertical stacking between distinct feature blocks follows `space-lg` and `space-xl` intervals to prevent cognitive fatigue.

## Elevation & Depth

Visual hierarchy leverages soft ambient shadows combined with subtle surface borders rather than high-contrast structural lines:

- **Canvas (Level 0)**: Flat `#F8FAFC`, non-elevated.
- **Surface Cards (Level 1)**: Pure `#FFFFFF` resting atop canvas, highlighted by a faint border (`1px solid rgba(15, 41, 66, 0.06)`) and a diffused ambient drop: `0 4px 16px -2px rgba(15, 41, 66, 0.05)`.
- **Interactive / Hover / Active (Level 2)**: Slightly lifted surface using `0 10px 24px -4px rgba(15, 41, 66, 0.08)`.
- **Modals, Drawers & Snackbars (Level 3)**: Deep contextual focus elevated via `0 20px 32px -8px rgba(15, 41, 66, 0.14)`.
- **Navy Accent Surfaces**: Cards using `#0F2942` use an inner top border (`1px solid rgba(255, 255, 255, 0.1)`) and soft deep shadow (`0 8px 24px -4px rgba(15, 41, 66, 0.25)`) to feel substantial and anchor key metric summaries.

## Shapes

The design system employs a soft, hyper-approachable corner geometry tailored to younger audiences:

- **Base Components (Inputs, Chips, Dropdowns)**: Rounded to `0.5rem` (`8px`) or `0.75rem` (`12px`).
- **Cards & Summary Containers**: Styled with generous `1rem` to `1.5rem` (`16px` - `24px`) radiuses (`rounded-2xl` and `rounded-3xl` equivalents) to project comfort and tactile friendliness.
- **Pills & Badges**: Fully pill-shaped (`9999px`) for academic badges, grade pills, and category tags.
- **Hero Banners**: Softly curbed bottoms and rounded internal corners to avoid any sharp or clinical sensation.

## Components

### Buttons
- **Primary**: Solid Deep Navy (`#0F2942`) with pure white text, `rounded-xl` (`16px`), height of `48px`, font weight `600`. Subtle scale-down feedback (`scale-98`) on press.
- **Secondary / Accent**: Solar Amber (`#FFB703`) background with `#0F2942` text for standout motivational actions (e.g., "Add Grade", "Allocate Budget").
- **Ghost / Tonal**: Soft gray or navy tint (`rgba(15, 41, 66, 0.06)`) with navy label; borderless.

### Grade Badges & Metric Indicators
- **Grade Pill**: Pill-shaped container (`rounded-full`) with a two-part composition: label on the left, bold mark on the right.
  - High Achievement (>= 16/20 or A grade): Light solar background (`#FEF08A`) with dark amber text (`#92400E`).
  - Standard (10–15/20): Soft slate background (`#F1F5F9`) with navy text (`#0F2942`).
  - Needs Attention (< 10/20): Soft rose container (`#FEE2E2`) with red text (`#991B1B`).
- **Average (GPA) Display Ring**: Concentric circular progress ring utilizing `#FFB703` for the progress fill against a `#E2E8F0` track, centered with bold `headline-md` typography.

### Financial Expense & Budget Cards
- White `#FFFFFF` card body with `20px` corner radius.
- Category icon housed in a `40px` circular container tinted with primary or secondary accents.
- Progress bar for category budget tracking: `8px` track height, `rounded-full`, transitioning from `#0F2942` to `#FFB703` as allocation reaches target.

### Form Inputs
- Background `#FFFFFF` with a `1px` border of `#E2E8F0`.
- Height of `48px`, `rounded-xl` (`12px`), with internal horizontal padding of `16px`.
- Active state transitions border to `#0F2942` with a `0 0 0 3px rgba(15, 41, 66, 0.1)` focus halo.
- Labels sit above input in `label-md` using `#64748B`.

### Lists & Transaction Rows
- Clean flat items separated by hairline dividers (`#F1F5F9`) or contained in discrete card stacks.
- Left-aligned title (`body-md`, semibold) with secondary timestamp (`body-sm`, neutral).
- Right-aligned monetary or grade impact in tabular, monospaced-aligned bold numerals.

### Checkboxes & Segmented Controls
- **Segmented Control**: Pill wrapper in `#F1F5F9` with a sliding white `#FFFFFF` pill thumb elevated by level 1 shadow.
- **Checkboxes**: `20px` square with `6px` corner rounding. Unchecked: `1.5px solid #CBD5E1`. Checked: Solid `#0F2942` with crisp white checkmark icon.