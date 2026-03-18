// src/lib/grid-layout.ts
//
// Functions:
//   findOptimalLayout4Col
//   findOptimalLayout3Col
//   findOptimalLayout2Col
//   getCardClasses
//
// Exported types: CardType, PlacedCard, LayoutConfig

export type CardType = "fixed" | "single" | "double" | "triple"

export interface PlacedCard {
  id: string
  type: CardType
  row: number // 1-indexed (matches CSS grid)
  col: number // 1-indexed (matches CSS grid)
  span: 1 | 2 | 3
}

export interface LayoutConfig {
  cols: 2 | 3 | 4
  triples: number
  doubles: number
  cards: PlacedCard[]
  gaps: number
  orphan: boolean
  lastEmpty?: boolean
}

// Tailwind v4 safe: static class mappings
export const ROW_SPAN_CLASSES = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
} as const

export const COL_START_CLASSES = {
  1: "col-start-1",
  2: "col-start-2",
  3: "col-start-3",
  4: "col-start-4",
} as const

export const ROW_START_CLASSES = {
  1: "row-start-1",
  2: "row-start-2",
  3: "row-start-3",
  4: "row-start-4",
  5: "row-start-5",
  6: "row-start-6",
  7: "row-start-7",
  8: "row-start-8",
  9: "row-start-9",
  10: "row-start-10",
  11: "row-start-11",
  12: "row-start-12",
  13: "row-start-13",
  14: "row-start-14",
  15: "row-start-15",
  16: "row-start-16",
  17: "row-start-17",
  18: "row-start-18",
  19: "row-start-19",
  20: "row-start-20",
  21: "row-start-21",
  22: "row-start-22",
  23: "row-start-23",
  24: "row-start-24",
  25: "row-start-25",
  26: "row-start-26",
  27: "row-start-27",
  28: "row-start-28",
  29: "row-start-29",
  30: "row-start-30",
} as const

// ============================================
// 4-COLUMN BREAKPOINT
// ============================================

/**
 * Find the optimal 4-column (or 3-column) layout for a set of single and
 * double-height cards. Brute-forces all (cols, triples) combinations, then
 * sorts by: no-orphan first → fewest gaps → prefer 4 cols → fewest triples.
 */
export function findOptimalLayout4Col(S: number, D: number): LayoutConfig {
  const configs: LayoutConfig[] = []
  for (const cols of [4, 3] as const) {
    for (let t = 0; t <= D; t++) {
      const d = D - t
      const cards = layoutCards4Col(S, d, t, cols)
      const { gaps, orphan } = analyzeLayout(cards, cols)
      configs.push({ cols, triples: t, doubles: d, cards, gaps, orphan })
    }
  }
  configs.sort((a, b) => {
    if (a.orphan !== b.orphan) return a.orphan ? 1 : -1
    if (a.gaps !== b.gaps) return a.gaps - b.gaps
    if (a.cols !== b.cols) return b.cols - a.cols
    return a.triples - b.triples
  })
  return configs[0]
}

function layoutCards4Col(S: number, D: number, T: number, cols: 3 | 4): PlacedCard[] {
  const cards: PlacedCard[] = []
  let sIdx = 1
  let dIdx = 1
  let tIdx = 1
  const totalTallCards = D + T
  const isLoneTallCard = totalTallCards === 1

  if (isLoneTallCard && cols === 4) {
    for (let c = 1; c <= 3 && sIdx <= S; c++) {
      cards.push({ id: `s${sIdx}`, type: sIdx <= 3 ? "fixed" : "single", row: 1, col: c, span: 1 })
      sIdx++
    }
    const span: 2 | 3 = T === 1 ? 3 : 2
    const type: CardType = T === 1 ? "triple" : "double"
    cards.push({
      id: type === "triple" ? `t${tIdx++}` : `d${dIdx++}`,
      type,
      row: 1,
      col: 4,
      span,
    })
    for (let c = 1; c <= 3 && sIdx <= S; c++) {
      for (let r = 0; r < span && sIdx <= S; r++) {
        cards.push({ id: `s${sIdx}`, type: "single", row: 2 + r, col: c, span: 1 })
        sIdx++
      }
    }
    let currentRow = 1 + span + 1
    let col = 1
    while (sIdx <= S) {
      cards.push({ id: `s${sIdx}`, type: "single", row: currentRow, col, span: 1 })
      sIdx++
      col++
      if (col > cols) {
        col = 1
        currentRow++
      }
    }
    return cards
  }

  const row1Count = Math.min(S, cols)
  for (let c = 1; c <= row1Count; c++) {
    cards.push({ id: `s${sIdx}`, type: sIdx <= 3 ? "fixed" : "single", row: 1, col: c, span: 1 })
    sIdx++
  }

  if (D === 0 && T === 0) {
    let col = 1
    let currentRow = 2
    while (sIdx <= S) {
      cards.push({ id: `s${sIdx}`, type: "single", row: currentRow, col, span: 1 })
      sIdx++
      col++
      if (col > cols) {
        col = 1
        currentRow++
      }
    }
    return cards
  }

  let currentRow = 2

  if (T > 0) {
    const tripleRowStart = currentRow
    let col = 1
    for (let i = 0; i < T; i++) {
      cards.push({ id: `t${tIdx++}`, type: "triple", row: currentRow, col, span: 3 })
      col++
      if (col > cols) {
        col = 1
        currentRow += 3
      }
    }
    const tripleRows = Math.ceil(T / cols)
    for (let tr = 0; tr < tripleRows && sIdx <= S; tr++) {
      const triplesInThisRow = Math.min(T - tr * cols, cols)
      for (let c = triplesInThisRow + 1; c <= cols && sIdx <= S; c++) {
        for (let r = 0; r < 3 && sIdx <= S; r++) {
          cards.push({
            id: `s${sIdx}`,
            type: "single",
            row: tripleRowStart + tr * 3 + r,
            col: c,
            span: 1,
          })
          sIdx++
        }
      }
    }
    currentRow = tripleRowStart + tripleRows * 3
  }

  if (D > 0) {
    const doubleRowStart = currentRow
    let col = 1
    for (let i = 0; i < D; i++) {
      cards.push({ id: `d${dIdx++}`, type: "double", row: currentRow, col, span: 2 })
      col++
      if (col > cols) {
        col = 1
        currentRow += 2
      }
    }
    const doubleRows = Math.ceil(D / cols)
    for (let dr = 0; dr < doubleRows && sIdx <= S; dr++) {
      const doublesInThisRow = Math.min(D - dr * cols, cols)
      for (let c = doublesInThisRow + 1; c <= cols && sIdx <= S; c++) {
        for (let r = 0; r < 2 && sIdx <= S; r++) {
          cards.push({
            id: `s${sIdx}`,
            type: "single",
            row: doubleRowStart + dr * 2 + r,
            col: c,
            span: 1,
          })
          sIdx++
        }
      }
    }
    currentRow = doubleRowStart + doubleRows * 2
  }

  let col = 1
  while (sIdx <= S) {
    cards.push({ id: `s${sIdx}`, type: "single", row: currentRow, col, span: 1 })
    sIdx++
    col++
    if (col > cols) {
      col = 1
      currentRow++
    }
  }

  return cards
}

// ============================================
// 3-COLUMN BREAKPOINT
// ============================================

/**
 * Find optimal layout for fixed 3-column grid with mixed packing.
 * Brute-forces triple promotions, sorts by: no-orphan → fewest gaps → fewest triples.
 */
export function findOptimalLayout3Col(S: number, D: number): LayoutConfig {
  const cols = 3
  const configs: LayoutConfig[] = []

  for (let t = 0; t <= D; t++) {
    const d = D - t
    const cards = layoutCards3Col(S, d, t)
    const { gaps, orphan, lastEmpty } = analyzeLayout3Col(cards)
    configs.push({ cols, triples: t, doubles: d, cards, gaps, orphan, lastEmpty })
  }

  configs.sort((a, b) => {
    if (a.orphan !== b.orphan) return a.orphan ? 1 : -1
    if (a.gaps !== b.gaps) return a.gaps - b.gaps
    return a.triples - b.triples
  })

  return configs[0]
}

function layoutCards3Col(S: number, D: number, T: number): PlacedCard[] {
  const cols = 3
  const cards: PlacedCard[] = []
  let sIdx = 1
  let dIdx = 1
  let tIdx = 1

  // Row 1: fill with singles (first 3 are fixed)
  const row1Count = Math.min(S, cols)
  for (let c = 1; c <= row1Count; c++) {
    cards.push({
      id: `s${sIdx}`,
      type: sIdx <= 3 ? "fixed" : "single",
      row: 1,
      col: c,
      span: 1,
    })
    sIdx++
  }

  let remS = S - row1Count
  let remD = D
  let remT = T
  let currentRow = 2

  // Triple-row blocks (mixed packing)
  // Each column can hold: T, D+S, or SSS
  while (remT > 0) {
    const blockStart = currentRow

    for (let c = 1; c <= cols; c++) {
      if (remT > 0) {
        cards.push({ id: `t${tIdx++}`, type: "triple", row: blockStart, col: c, span: 3 })
        remT--
      } else if (remD > 0 && remS > 0) {
        cards.push({ id: `d${dIdx++}`, type: "double", row: blockStart, col: c, span: 2 })
        remD--
        cards.push({ id: `s${sIdx++}`, type: "single", row: blockStart + 2, col: c, span: 1 })
        remS--
      } else if (remS >= 3) {
        for (let r = 0; r < 3; r++) {
          cards.push({ id: `s${sIdx++}`, type: "single", row: blockStart + r, col: c, span: 1 })
        }
        remS -= 3
      } else if (remD > 0) {
        cards.push({ id: `d${dIdx++}`, type: "double", row: blockStart, col: c, span: 2 })
        remD--
      } else {
        for (let r = 0; r < 3 && remS > 0; r++) {
          cards.push({ id: `s${sIdx++}`, type: "single", row: blockStart + r, col: c, span: 1 })
          remS--
        }
      }
    }

    currentRow += 3
  }

  // Double-row blocks
  // Each column can hold: D or SS
  while (remD > 0) {
    const blockStart = currentRow

    for (let c = 1; c <= cols; c++) {
      if (remD > 0) {
        cards.push({ id: `d${dIdx++}`, type: "double", row: blockStart, col: c, span: 2 })
        remD--
      } else if (remS >= 2) {
        cards.push({ id: `s${sIdx++}`, type: "single", row: blockStart, col: c, span: 1 })
        cards.push({ id: `s${sIdx++}`, type: "single", row: blockStart + 1, col: c, span: 1 })
        remS -= 2
      } else if (remS > 0) {
        cards.push({ id: `s${sIdx++}`, type: "single", row: blockStart, col: c, span: 1 })
        remS--
      }
    }

    currentRow += 2
  }

  // Remaining singles (flat rows)
  let col = 1
  while (remS > 0) {
    cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow, col, span: 1 })
    remS--
    col++
    if (col > cols) {
      col = 1
      currentRow++
    }
  }

  return cards
}

function analyzeLayout3Col(cards: PlacedCard[]): {
  gaps: number
  orphan: boolean
  lastEmpty: boolean
} {
  const cols = 3
  if (cards.length === 0) return { gaps: 0, orphan: false, lastEmpty: false }

  const maxRow = Math.max(...cards.map((c) => c.row + c.span - 1))
  const grid: boolean[][] = Array.from({ length: maxRow }, () => Array(cols).fill(false))

  for (const card of cards) {
    for (let r = card.row - 1; r < card.row - 1 + card.span; r++) {
      if (r < maxRow) grid[r][card.col - 1] = true
    }
  }

  let gaps = 0
  for (const row of grid) {
    gaps += row.filter((cell) => !cell).length
  }

  const lastRowFilled = grid[maxRow - 1].filter((x) => x).length
  const orphan = lastRowFilled === 1
  const lastEmpty = gaps === 1 && lastRowFilled === 2

  return { gaps, orphan, lastEmpty }
}

// ============================================
// 2-COLUMN BREAKPOINT
// ============================================

/**
 * Find optimal layout for 2-column (mobile) grid.
 * Deterministic: promotes 1 double to triple when total cells is odd (to make even).
 */
export function findOptimalLayout2Col(S: number, D: number): LayoutConfig {
  const cols = 2
  const totalCells = S + D * 2

  let T = 0
  if (totalCells % 2 !== 0 && D >= 1) {
    T = 1
  }

  const d = D - T
  const cards = layoutCards2Col(S, d, T)
  const { gaps, orphan } = analyzeLayout(cards, cols)

  return { cols, triples: T, doubles: d, cards, gaps, orphan }
}

function layoutCards2Col(S: number, D: number, T: number): PlacedCard[] {
  const cols = 2
  const cards: PlacedCard[] = []
  let sIdx = 1
  let dIdx = 1
  let tIdx = 1

  // Row 1: 2 singles (first 2 are fixed)
  const row1Count = Math.min(S, cols)
  for (let c = 1; c <= row1Count; c++) {
    cards.push({
      id: `s${sIdx}`,
      type: sIdx <= 2 ? "fixed" : "single",
      row: 1,
      col: c,
      span: 1,
    })
    sIdx++
  }

  let remS = S - row1Count
  let remD = D
  let remT = T
  let currentRow = 2

  // Triples in pairs
  while (remT >= 2) {
    cards.push({ id: `t${tIdx++}`, type: "triple", row: currentRow, col: 1, span: 3 })
    cards.push({ id: `t${tIdx++}`, type: "triple", row: currentRow, col: 2, span: 3 })
    remT -= 2
    currentRow += 3
  }

  // Lone triple: pair with D+S or SSS
  if (remT === 1) {
    cards.push({ id: `t${tIdx++}`, type: "triple", row: currentRow, col: 1, span: 3 })
    remT--

    if (remD > 0 && remS > 0) {
      cards.push({ id: `d${dIdx++}`, type: "double", row: currentRow, col: 2, span: 2 })
      remD--
      cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow + 2, col: 2, span: 1 })
      remS--
    } else if (remS >= 3) {
      for (let r = 0; r < 3; r++) {
        cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow + r, col: 2, span: 1 })
      }
      remS -= 3
    } else if (remD > 0) {
      cards.push({ id: `d${dIdx++}`, type: "double", row: currentRow, col: 2, span: 2 })
      remD--
    } else {
      for (let r = 0; r < 3 && remS > 0; r++) {
        cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow + r, col: 2, span: 1 })
        remS--
      }
    }

    currentRow += 3
  }

  // Doubles in pairs
  while (remD >= 2) {
    cards.push({ id: `d${dIdx++}`, type: "double", row: currentRow, col: 1, span: 2 })
    cards.push({ id: `d${dIdx++}`, type: "double", row: currentRow, col: 2, span: 2 })
    remD -= 2
    currentRow += 2
  }

  // Lone double: pair with SS
  if (remD === 1) {
    cards.push({ id: `d${dIdx++}`, type: "double", row: currentRow, col: 1, span: 2 })
    remD--

    if (remS >= 2) {
      cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow, col: 2, span: 1 })
      cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow + 1, col: 2, span: 1 })
      remS -= 2
    } else if (remS === 1) {
      cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow, col: 2, span: 1 })
      remS--
    }

    currentRow += 2
  }

  // Remaining singles in pairs
  while (remS >= 2) {
    cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow, col: 1, span: 1 })
    cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow, col: 2, span: 1 })
    remS -= 2
    currentRow++
  }

  // Orphan single (only odd S + 0D)
  if (remS === 1) {
    cards.push({ id: `s${sIdx++}`, type: "single", row: currentRow, col: 1, span: 1 })
  }

  return cards
}

// ============================================
// SHARED ANALYSIS (reused by 4-col and 2-col)
// ============================================

function analyzeLayout(cards: PlacedCard[], cols: number): { gaps: number; orphan: boolean } {
  if (cards.length === 0) return { gaps: 0, orphan: false }
  const maxRow = Math.max(...cards.map((c) => c.row + c.span - 1))
  const grid: boolean[][] = Array.from({ length: maxRow }, () => Array(cols).fill(false))
  for (const card of cards) {
    for (let r = card.row - 1; r < card.row - 1 + card.span; r++) {
      if (r < maxRow) grid[r][card.col - 1] = true
    }
  }
  let gaps = 0
  for (const row of grid) gaps += row.filter((cell) => !cell).length
  let lastRowCount = 0
  for (const card of cards) {
    if (card.row + card.span - 1 === maxRow) lastRowCount++
  }
  return { gaps, orphan: lastRowCount === 1 }
}

// ============================================
// CLASS GENERATION
// ============================================

/**
 * Get Tailwind CSS positioning classes for a placed card.
 * Returns `row-start-N col-start-N row-span-N` string for explicit grid placement.
 */
export function getCardClasses(card: PlacedCard): string {
  const rowStart = ROW_START_CLASSES[card.row as keyof typeof ROW_START_CLASSES] ?? ""
  const colStart = COL_START_CLASSES[card.col as keyof typeof COL_START_CLASSES] ?? ""
  const rowSpan = ROW_SPAN_CLASSES[card.span]
  return `${rowStart} ${colStart} ${rowSpan}`
}
