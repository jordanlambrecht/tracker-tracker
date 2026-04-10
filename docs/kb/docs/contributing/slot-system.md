# Bento Grid Slot System

The tracker detail page's Data & Analytics tab uses a slot-based bento grid to render platform-specific stat cards alongside universal core stats. Learn how it works and how to add a new card.

---

## What is the bento grid?

The analytics tab combines eight fixed core stats with platform-specific slot cards. Slots decide at render time whether to show — return `null` to hide.

The grid packs 1-tall and 2-tall cards cleanly without orphans or gaps. Instead of CSS auto-placement, the layout algorithm pre-computes `row-start`, `col-start`, and `row-span` classes per breakpoint.

**Why explicit positioning?** Tailwind auto-placement leaves holes when mixing 1-tall and 2-tall cards. Explicit positioning gives full control.

---

## Slot categories

Every slot belongs to one of three categories defined in `src/lib/slot-types.ts`:

```ts
export type SlotCategory = "badge" | "stat-card" | "progress"
```

| Category    | What it renders                                                        | Where it appears                                                  |
| ----------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `stat-card` | A `StatCard` component (basic, stacked, or ring variant)               | Inside the bento grid                                             |
| `badge`     | A `SlotBadge` pill (Warned, Donor, Parked, etc.)                       | Collected and displayed as a badge row above the grid             |
| `progress`  | An arbitrary component (achievement progress bars, share score, buffs) | Rendered as a flex column above the bento grid via `SlotRenderer` |

This document focuses on **`stat-card`** slots, as they are the most common thing to add.

---

## Slot sizes

| `span` | CardType | Description |
| --- | --- | --- |
| `1` (default) | `single` | 1x1 card |
| `2` | `double` or `triple` | 2-row tall card; algorithm may promote to `triple` (3 rows) for better layout |

Promotion happens automatically when it reduces gaps. You only declare `span: 1` or `span: 2` — the algorithm handles `triple`.

---

## Type definitions

### SlotContext

Data your slot's `resolve` function receives:

```ts
export interface SlotContext {
  tracker: TrackerSummary
  latestSnapshot: Snapshot | null
  snapshots: Snapshot[]
  meta: GGnPlatformMeta | GazellePlatformMeta | NebulancePlatformMeta | null
  registry: TrackerRegistryEntry | undefined
  accentColor: string // hex, e.g. "#00d4ff"
}
```

`meta` is null for UNIT3D trackers and platforms without extra data. Always guard `if (!meta)` before accessing platform fields.

### ResolvedSlot

What the registry produces after it calls `resolve`:

```ts
// src/lib/slot-types.ts
export interface ResolvedSlot {
  id: string
  category: SlotCategory
  props: Record<string, unknown>
  priority: number
  span: 1 | 2
}
```

### SlotDefinition (internal)

The shape of each entry in `SLOT_DEFINITIONS`:

```ts
interface SlotDefinition<P = Record<string, unknown>> {
  id: string
  category: SlotCategory
  component: ComponentType<P>
  resolve: (ctx: SlotContext) => P | null // null = hide this slot
  priority: number
  span?: 1 | 2 // omit for 1 (default)
}
```

`AnySlotDefinition` is the erased version used in the exported array so that typed generics can coexist in a heterogeneous list without double-casts.

---

## StatCard variants

All stat-card slots use `StatCard` from `src/components/ui/StatCard.tsx`. Pick one of three variants via `type`.

### `basic` (default)

Single hero value for any scalar metric.

```ts
interface StatCardBasicProps {
  type?: "basic"
  label: string
  value: string | number
  unit?: string // "BON", "GiB", etc.
  subtitle?: string
  subValue?: string
  trend?: "up" | "down" | "flat"
  tooltip?: string // shows "?" button with popover
  icon?: ReactNode // 16x16
  accentColor?: string
  alert?: "warn" | "danger"
  alertReason?: string // shown in "!" tooltip
}
```

### `stacked`

Multiple label/value rows. Use when a concept has two or three related figures (e.g. Freeleech tokens + Merit tokens).

```ts
interface StatCardStackedProps {
  type: "stacked" // required
  title: string // card title
  rows: Array<{
    label: string
    value: string | number
    prefix?: string // prepended to value display
    unit?: string
    colorClass?: string // Tailwind class, e.g. "text-success"
  }>
  total?: {
    label: string // displayed below a divider
    value: string
    unit?: string
  }
  sumIsHero?: boolean // promote the total to a large hero above the rows
  tooltip?: string
  icon?: ReactNode
  accentColor?: string
  alert?: "warn" | "danger"
  alertReason?: string
}
```

A `stacked` card with `span: 2` takes two grid rows, giving rows more vertical space.

### `ring`

Countdown progress ring for login deadlines. Renders an SVG ring that fills and turns amber → red as the deadline nears.

```ts
interface StatCardRingProps {
  type: "ring"
  title?: string // defaults to "Login Deadline"
  lastAccessAt: string // ISO date
  loginIntervalDays: number
  tooltip?: string
  accentColor?: string
  alert?: "warn" | "danger"
  alertReason?: string
}
```

You'll rarely need more than one ring card.

---

## How to add a new stat card slot

### 1. Decide what data you need

If your data is in `latestSnapshot`, read it directly. For platform-specific `meta`, check `*PlatformMeta` in `src/lib/adapters/types.ts`.

### 2. Write the slot definition

Add a new constant in `src/components/tracker-detail/slot-registry.ts`. Place it with the other stat-card slots:

```ts
// Example: a basic card showing invite count for a hypothetical platform
const myTrackerInvitesSlot: SlotDefinition<StatCardBasicProps> = {
  id: "my-tracker-invites", // must be unique across all slots
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 50, // lower = renders earlier (leftmost/topmost)
  // span: 1,                       // omit for default 1-tall card
  resolve(ctx) {
    const { meta, accentColor } = ctx
    if (!meta || !("invites" in meta)) return null // guard: wrong platform
    const invites = (meta as MyPlatformMeta).invites
    if (typeof invites !== "number" || invites <= 0) return null // hide when empty
    return {
      label: "Invites",
      value: invites,
      accentColor,
      icon: icon16(UserIcon),
    }
  },
}
```

For a `stacked` (double-height) card:

```ts
const myTrackerTokensSlot: SlotDefinition<StatCardStackedProps> = {
  id: "my-tracker-tokens",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardStackedProps>,
  priority: 30,
  span: 2, // 2-row tall card
  resolve(ctx) {
    const { meta, accentColor } = ctx
    if (!meta || !("giftTokens" in meta)) return null
    const m = meta as MyPlatformMeta
    return {
      type: "stacked" as const, // required for stacked
      title: "Tokens",
      rows: [
        { label: "Gift", value: m.giftTokens ?? 0 },
        { label: "Merit", value: m.meritTokens ?? 0 },
      ],
      total: { label: "Total", value: String((m.giftTokens ?? 0) + (m.meritTokens ?? 0)) },
      accentColor,
    }
  },
}
```

### 3. Register it

Add the slot to `SLOT_DEFINITIONS` in `slot-registry.ts`. Array order doesn't matter — `priority` does. Lower priority = renders first.

```ts
export const SLOT_DEFINITIONS: AnySlotDefinition[] = [
  loginDeadlineSlot,
  goldSlot,
  myTrackerInvitesSlot, // add here
  myTrackerTokensSlot,
  // ...
]
```

Done. The system picks it up automatically.

### 4. Verify the resolve guard

The `resolve` function is called for every tracker detail page, regardless of platform. It must return `null` whenever the data is not present or not applicable. Failing to guard will show broken cards on unrelated trackers.

Common guard patterns:

```ts
// Guard: only for GGn
if (!meta || !("hourlyGold" in meta)) return null

// Guard: only for Gazelle-family (has community object)
if (!meta || !("community" in meta)) return null

// Guard: hide when value is zero or missing
if (value == null || value <= 0) return null
```

---

## The layout algorithm

File: `src/lib/grid-layout.ts`

### Card types

The algorithm operates on three internal card sizes:

| Type     | Row span | Assigned to                                              |
| -------- | -------- | -------------------------------------------------------- |
| `single` | 1        | Core stats + `span: 1` slot cards                        |
| `double` | 2        | `span: 2` slot cards                                     |
| `triple` | 3        | A `double` that was promoted to fill a triple-height gap |

The first N cards in the `single` pool are marked `fixed` (N = number of columns). Fixed cards are always placed in row 1 and are never moved.

### 4-column breakpoint (`findOptimalLayout4Col`)

This is the main desktop layout. It tries all valid combinations of column count (3 or 4) and promotions, ranking by:

1. No orphaned card in the last row (preferred)
2. Fewest gap cells
3. Prefer 4 columns over 3
4. Fewest promotions

The winner's cards get a `{ row, col, span }` placement. `getCardClasses` converts these to static Tailwind classes (`row-start-N col-start-N row-span-N`). Row/col classes are pre-enumerated lookup tables (up to 30 rows) instead of generated, because Tailwind v4 requires static class names.

**Placement order:**

- Row 1: core stat singles (up to 4)
- Triple-height blocks: promoted doubles fill columns left to right; other columns get stacked singles
- Double-height blocks: doubles fill columns left to right; other columns get pairs of singles
- Remaining singles: flow left to right, top to bottom

### 3-column breakpoint (`findOptimalLayout3Col`)

Fixed 3 columns. Same brute-force strategy, ranks by: no-orphan → fewest gaps → fewest triples. **Currently wired to the `md` breakpoint** (`hidden md:grid md:grid-cols-3 lg:hidden`).

### 2-column breakpoint (`findOptimalLayout2Col`)

Fixed 2 columns. Deterministic: promotes at most one double to triple when the total cell count is odd. **Currently wired to mobile** (`grid grid-cols-2 md:hidden`).

### Breakpoint wiring (current status)

| Breakpoint            | Tailwind class                       | Algorithm               | Status           |
| --------------------- | ------------------------------------ | ----------------------- | ---------------- |
| Mobile (`< md`)       | `grid-cols-2`                        | `findOptimalLayout2Col` | Wired and active |
| Medium (`md` to `lg`) | `md:grid-cols-3`                     | `findOptimalLayout3Col` | Wired and active |
| Large (`>= lg`)       | `lg:grid-cols-3` or `lg:grid-cols-4` | `findOptimalLayout4Col` | Wired and active |

The large grid uses `lg:grid-cols-4` when the algorithm picks 4 columns, or `lg:grid-cols-3` when 3 produces fewer gaps.

---

## How the renderer maps cards to content

In `AnalyticsTab.tsx`, `renderLayoutCards` iterates placed cards and maps each ID to a React element:

- `s1` through `s{coreCount}` → core stat descriptors
- `s{coreCount + 1}` onward → `span: 1` slot cards, by priority
- `t1`, `t2`, ... → the first T promoted doubles (triples)
- `d1`, `d2`, ... → remaining doubles (offset by T)

The full pipeline:

```md
Build SlotContext in tracker detail page
  → Call SLOT_DEFINITIONS[n].resolve(ctx) for each
  → Filter out null returns
  → Sort survivors by priority
  → Split into singleSlots (span=1) and doubleSlots (span=2)
  → Pass counts to layout algorithms
  → Layout algorithms return PlacedCard[]
  → renderLayoutCards maps card IDs to elements
  → getCardClasses(card) produces positioning classes
  → Render as <div className={positionClasses}>{element}</div>
```

---

## Adding a new badge slot

Badge slots use the same `SlotDefinition` shape but render via `SlotBadge`:

```ts
const myBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "my-badge",
  category: "badge", // not "stat-card"
  component: SlotBadge,
  priority: 40,
  resolve(ctx) {
    if (!someCondition(ctx)) return null
    return { variant: "warn", label: "My Badge" }
  },
}
```

`SlotBadgeProps` variants: `"default"`, `"accent"`, `"warn"`, `"danger"`. Badges are collected separately and rendered as a horizontal pill row above the bento grid.

---

## Key files reference

| File                                              | Purpose                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/slot-types.ts`                           | `SlotCategory`, `SlotContext`, `ResolvedSlot` types                                         |
| `src/lib/grid-layout.ts`                          | `findOptimalLayout4Col`, `findOptimalLayout3Col`, `findOptimalLayout2Col`, `getCardClasses` |
| `src/components/tracker-detail/slot-registry.ts`  | All slot definitions + `SLOT_DEFINITIONS` array + `renderSlotElement`                       |
| `src/components/ui/StatCard.tsx`                  | `StatCard` component (basic / stacked / ring)                                               |
| `src/components/tracker-detail/AnalyticsTab.tsx`  | Grid renderer — calls layout algorithms, maps card IDs to elements                          |
| `src/components/tracker-detail/CoreStatCards.tsx` | `buildCoreStatDescriptors` — the 8 fixed core stats                                         |
| `src/components/tracker-detail/SlotRenderer.tsx`  | Renders `progress` category slots above the grid                                            |
