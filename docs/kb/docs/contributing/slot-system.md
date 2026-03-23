# Bento Grid Slot System

The tracker detail page's Data & Analytics tab uses a slot-based bento grid to render per-platform stat cards alongside the universal core stats. This document covers how the system works and how to add a new stat card.

---

## What is the bento grid?

The analytics tab combines eight fixed core stats (Uploaded, Downloaded, Ratio, Buffer, Seeding, Leeching, Hit & Runs, Required Ratio) with a variable number of platform-specific slot cards. Slots are registered centrally and each slot decides at render time whether it has anything to show for the current tracker — if not, it returns `null` and is excluded entirely from the layout.

The grid needs to pack single-height and double-height cards into a clean rectangular layout without orphaned cells or large gaps. Rather than using CSS auto-placement (which can leave unpredictable holes), the layout algorithm runs ahead of time and produces explicit `row-start`, `col-start`, and `row-span` classes for every card. Each responsive breakpoint has its own algorithm and produces an independent placement.

**Why explicit positioning?** Tailwind's CSS grid auto-placement works fine for uniform grids, but breaks down when mixing 1-tall and 2-tall cards across multiple breakpoints. Explicit positioning gives full control over where each card lands and eliminates gaps.

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

Each stat-card slot has a `span` field that determines how many grid rows it occupies.

| `span`        | CardType in layout                 | Description                                                                                                                             |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `1` (default) | `single`                           | Standard 1×1 card — one row tall, one column wide                                                                                       |
| `2`           | `double` (or `triple` if promoted) | Tall card — two rows tall, one column wide. Can be promoted to `triple` (three rows) by the algorithm when it produces a better layout. |

The algorithm may promote a `double` to a `triple` (three rows) when doing so reduces gaps or eliminates an orphan. This is purely a layout decision — the slot itself only declares `span: 1` or `span: 2`. The `triple` type exists in `CardType` but is never assigned directly by slot authors.

---

## Type definitions

### SlotContext

The object passed to every slot's `resolve` function:

```ts
// src/lib/slot-types.ts
export interface SlotContext {
  tracker: TrackerSummary // DB row + computed fields
  latestSnapshot: Snapshot | null
  snapshots: Snapshot[]
  meta: GGnPlatformMeta | GazellePlatformMeta | NebulancePlatformMeta | null
  registry: TrackerRegistryEntry | undefined
  accentColor: string // tracker's hex color, e.g. "#00d4ff"
}
```

`meta` is the platform-specific extra data returned by the adapter. It is `null` for UNIT3D trackers (they have no extra meta yet). Always guard with `if (!meta)` before accessing platform fields.

### ResolvedSlot

What the registry produces after calling `resolve`:

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

All stat-card slots render via the unified `StatCard` component in `src/components/ui/StatCard.tsx`. It has three variants selected by the `type` prop.

### `basic` (default)

Single hero value. Use for any scalar metric.

```ts
interface StatCardBasicProps {
  type?: "basic" // optional — "basic" is the default
  label: string // card title, displayed uppercase
  value: string | number // large hero number
  unit?: string // displayed small next to value, e.g. "BON", "GiB"
  subtitle?: string // small text below the value
  subValue?: string // secondary line, mono font, tertiary color
  trend?: "up" | "down" | "flat"
  tooltip?: string // adds a "?" button with a popover
  icon?: ReactNode // 16×16 icon in the top-right corner
  accentColor?: string // hex color for the glow effect
  alert?: "warn" | "danger"
  alertReason?: string // shown in a "!" tooltip when alert is set
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

A `stacked` card with `span: 2` occupies two grid rows, giving the rows more vertical breathing room.

### `ring`

Countdown progress ring. Used exclusively for the Login Deadline card. Renders an SVG ring that fills as the deadline approaches and turns amber → red as it gets close.

```ts
interface StatCardRingProps {
  type: "ring" // required
  title?: string // defaults to "Login Deadline"
  lastAccessAt: string // ISO date string of last tracker visit
  loginIntervalDays: number // from registry entry's rules.loginIntervalDays
  tooltip?: string
  accentColor?: string
  alert?: "warn" | "danger"
  alertReason?: string
}
```

The ring variant is driven by data from `ctx.tracker.lastAccessAt` and `ctx.registry?.rules?.loginIntervalDays`. It is unlikely you will need a second ring card.

---

## How to add a new stat card slot

### 1. Decide what data you need

Look at `SlotContext` above. If your data is in `latestSnapshot`, you can read it directly. If it requires platform-specific `meta`, check what fields are available on the relevant `*PlatformMeta` type in `src/lib/adapters/types.ts`.

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

Add the slot to the `SLOT_DEFINITIONS` array at the bottom of `slot-registry.ts`. The array order does not determine layout position — `priority` does. Lower priority numbers appear first (leftmost in the first available row).

```ts
export const SLOT_DEFINITIONS: AnySlotDefinition[] = [
  // stat-card slots
  loginDeadlineSlot,
  goldSlot,
  // ... existing slots ...
  myTrackerInvitesSlot, // add here
  myTrackerTokensSlot,
  // badge slots
  // ...
]
```

That is all. The resolver, layout algorithm, and renderer pick it up automatically.

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

This is the primary desktop layout. It brute-forces all valid combinations of column count (3 or 4) and double-to-triple promotions, then ranks them by:

1. No orphaned card in the last row (preferred)
2. Fewest gap cells
3. Prefer 4 columns over 3
4. Fewest triples (promotions)

The winning configuration's cards each receive a `{ row, col, span }` placement. `getCardClasses` turns these into static Tailwind classes (`row-start-N col-start-N row-span-N`). The row/col start classes are pre-enumerated as lookup tables (up to 30 rows) rather than generated dynamically, because Tailwind v4 requires static class names for its JIT scanner.

**Placement order within the winner:**

- Row 1: core stat singles (up to 4)
- Triple-height blocks: promoted doubles fill columns left to right; remaining columns in the same row block are filled with singles stacked 3-tall
- Double-height blocks: doubles fill columns left to right; remaining columns filled with pairs of singles
- Remaining singles: flow left to right, top to bottom in remaining rows

### 3-column breakpoint (`findOptimalLayout3Col`)

Fixed 3 columns. Same brute-force promotion strategy but ranks by: no-orphan → fewest gaps → fewest triples (no column-count preference since columns are fixed). Implemented and tested. **Currently wired into the `md` breakpoint** (`hidden md:grid md:grid-cols-3 lg:hidden`).

### 2-column breakpoint (`findOptimalLayout2Col`)

Fixed 2 columns. Deterministic: promotes at most one double to a triple when the total cell count is odd (to keep columns balanced). **Currently wired into the mobile grid** (`grid grid-cols-2 md:hidden`).

### Breakpoint wiring (current status)

| Breakpoint            | Tailwind class                       | Algorithm               | Status           |
| --------------------- | ------------------------------------ | ----------------------- | ---------------- |
| Mobile (`< md`)       | `grid-cols-2`                        | `findOptimalLayout2Col` | Wired and active |
| Medium (`md` to `lg`) | `md:grid-cols-3`                     | `findOptimalLayout3Col` | Wired and active |
| Large (`>= lg`)       | `lg:grid-cols-3` or `lg:grid-cols-4` | `findOptimalLayout4Col` | Wired and active |

The large grid uses `lg:grid-cols-4` when the algorithm selects 4 columns, or `lg:grid-cols-3` when it finds 3 columns produces fewer gaps.

---

## How the renderer maps cards to content

In `AnalyticsTab.tsx`, `renderLayoutCards` iterates the placed cards and maps each card ID to a React element:

- `s1` through `s{coreCount}` → core stat descriptors from `buildCoreStatDescriptors`
- `s{coreCount + 1}` onward → `span: 1` slot cards in priority order
- `t1`, `t2`, ... → the first T promoted slot doubles (triples)
- `d1`, `d2`, ... → the remaining slot doubles (at offset T)

The full pipeline for stat-card slots:

```
SlotContext built in tracker detail page
  → SLOT_DEFINITIONS[n].resolve(ctx) called for each definition
  → null returns filtered out
  → surviving slots sorted by priority
  → split into singleSlots (span=1) and doubleSlots (span=2)
  → counts passed to layout algorithms
  → layout algorithms return PlacedCard[]
  → renderLayoutCards maps card IDs to elements
  → getCardClasses(card) produces positioning classes
  → rendered as <div className={positionClasses}>{element}</div>
```

---

## Adding a new badge slot

Badge slots follow the same `SlotDefinition` shape but use `SlotBadge` as the component:

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

`SlotBadgeProps` variants: `"default"`, `"accent"`, `"warn"`, `"danger"`. Badges are collected separately from stat-card slots and rendered as a horizontal pill row, not inside the bento grid.

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
