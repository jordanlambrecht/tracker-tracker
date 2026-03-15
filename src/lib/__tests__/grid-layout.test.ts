// src/lib/__tests__/grid-layout.test.ts

import { describe, expect, it } from "vitest"
import {
  findOptimalLayout2Col,
  findOptimalLayout3Col,
  findOptimalLayout4Col,
  getCardClasses,
} from "@/lib/grid-layout"

describe("findOptimalLayout4Col", () => {
  // Case 1: 4S + 0D → 4 cols, 0T (fills exactly one row)
  it("case 1: 4S+0D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(4, 0)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 2: 5S + 0D → 3 cols, 0T (avoids orphan at 4 cols)
  it("case 2: 5S+0D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(5, 0)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 3: 4S + 1D → 4 cols, 0T (lone double at col 4)
  it("case 3: 4S+1D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(4, 1)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 4: 6S + 1D → 3 cols, 0T (new algo: 3 cols achieves fewer gaps than 4)
  it("case 4: 6S+1D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(6, 1)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 5: 5S + 2D → 3 cols, 0T
  it("case 5: 5S+2D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(5, 2)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 6: 8S + 2D → 4 cols, 0T
  it("case 6: 8S+2D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(8, 2)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 7: 7S + 1D → 3 cols, 0T
  it("case 7: 7S+1D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(7, 1)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 8: 11S + 3D → 4 cols, 3T (new algo promotes all 3 doubles for 0 gaps)
  it("case 8: 11S+3D → 4 cols, 3T", () => {
    const r = findOptimalLayout4Col(11, 3)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(3)
  })

  // Case 9: 13S + 4D → 4 cols, 3T (new algo promotes 3 doubles for 0 gaps)
  it("case 9: 13S+4D → 4 cols, 3T", () => {
    const r = findOptimalLayout4Col(13, 4)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(3)
  })

  // Case 10: 13S + 5D → 4 cols, 1T
  it("case 10: 13S+5D → 4 cols, 1T", () => {
    const r = findOptimalLayout4Col(13, 5)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(1)
  })

  // Case 11: 3S + 0D → 3 cols, 0T
  it("case 11: 3S+0D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(3, 0)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 12: 3S + 1D → 4 cols, 0T (lone double exception; new algo: 4 cols lone tall)
  it("case 12: 3S+1D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(3, 1)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 13: 3S + 2D → 3 cols, 0T
  it("case 13: 3S+2D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(3, 2)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 14: 9S + 0D → 3 cols, 0T (exactly 3 rows of 3)
  it("case 14: 9S+0D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(9, 0)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 15: 13S + 0D → 3 cols, 0T (orphan unavoidable on both; 3 cols scores lower)
  it("case 15: 13S+0D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(13, 0)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 16: 7S + 4D → 3 cols, 0T
  it("case 16: 7S+4D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(7, 4)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 17: 10S + 2D → 4 cols, 2T (new algo: 4 cols with 2 promotions gives 0 gaps)
  it("case 17: 10S+2D → 4 cols, 2T", () => {
    const r = findOptimalLayout4Col(10, 2)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(2)
  })

  // Case 18: 6S + 3D → 4 cols, 0T
  it("case 18: 6S+3D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(6, 3)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 19: 9S + 3D → 3 cols, 0T
  it("case 19: 9S+3D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(9, 3)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 20: 4S + 4D → 4 cols, 0T
  it("case 20: 4S+4D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(4, 4)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 21: 8S + 4D → 4 cols, 0T
  it("case 21: 8S+4D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(8, 4)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 22: 10S + 4D → 3 cols, 0T
  it("case 22: 10S+4D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(10, 4)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // Case 23: 15S + 3D → 4 cols, 3T (new algo: promotes all 3 for 0 gaps at 4 cols)
  it("case 23: 15S+3D → 4 cols, 3T", () => {
    const r = findOptimalLayout4Col(15, 3)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(3)
  })

  // Case 24: 20S + 4D → 4 cols, 0T
  it("case 24: 20S+4D → 4 cols, 0T", () => {
    const r = findOptimalLayout4Col(20, 4)
    expect(r.cols).toBe(4)
    expect(r.triples).toBe(0)
  })

  // Case 25: 6S + 6D → 3 cols, 0T
  it("case 25: 6S+6D → 3 cols, 0T", () => {
    const r = findOptimalLayout4Col(6, 6)
    expect(r.cols).toBe(3)
    expect(r.triples).toBe(0)
  })

  // General invariants
  it("always returns cols in [3, 4]", () => {
    for (let s = 3; s <= 20; s++) {
      for (let d = 0; d <= 6; d++) {
        const r = findOptimalLayout4Col(s, d)
        expect(r.cols).toBeGreaterThanOrEqual(3)
        expect(r.cols).toBeLessThanOrEqual(4)
      }
    }
  })

  it("triples never exceeds doubles count", () => {
    for (let s = 3; s <= 20; s++) {
      for (let d = 0; d <= 6; d++) {
        const r = findOptimalLayout4Col(s, d)
        expect(r.triples).toBeGreaterThanOrEqual(0)
        expect(r.triples).toBeLessThanOrEqual(d)
      }
    }
  })
})

describe("findOptimalLayout4Col.cards (placement)", () => {
  it("places all cards without overlap", () => {
    const layout = findOptimalLayout4Col(8, 2)
    expect(layout.cards.length).toBe(10)

    // Check no overlapping positions (1-indexed)
    const occupied = new Set<string>()
    for (const card of layout.cards) {
      for (let r = card.row; r < card.row + card.span; r++) {
        const key = `${r},${card.col}`
        expect(occupied.has(key)).toBe(false)
        occupied.add(key)
      }
    }
  })

  it("places all cards without overlap for a larger set", () => {
    const layout = findOptimalLayout4Col(8, 3)
    expect(layout.cards.length).toBe(11)

    const occupied = new Set<string>()
    for (const card of layout.cards) {
      for (let r = card.row; r < card.row + card.span; r++) {
        const key = `${r},${card.col}`
        expect(occupied.has(key)).toBe(false)
        occupied.add(key)
      }
    }

    // First row cards should be singles/fixed in row 1
    const row1Singles = layout.cards.filter(
      (c) => c.row === 1 && (c.type === "single" || c.type === "fixed"),
    )
    expect(row1Singles.length).toBeGreaterThanOrEqual(3)
  })

  it("returns correct types when doubles are promoted to triples", () => {
    // Use a case where the algorithm promotes — 10S+2D → 4 cols, 2T
    const layout = findOptimalLayout4Col(10, 2)
    expect(layout.triples).toBe(2)

    const triples = layout.cards.filter((c) => c.type === "triple")
    const doubles = layout.cards.filter((c) => c.type === "double")
    expect(triples.length).toBe(2)
    expect(doubles.length).toBe(0)
    expect(triples[0].span).toBe(3)
  })

  it("lone tall is placed at col 4 in a 4-col layout", () => {
    const layout = findOptimalLayout4Col(4, 1)
    expect(layout.cols).toBe(4)
    expect(layout.triples).toBe(0)

    const tallCard = layout.cards.find((c) => c.type === "double")
    expect(tallCard?.col).toBe(4)
    expect(tallCard?.row).toBe(1)
  })

  it("all cards appear exactly once", () => {
    const layout = findOptimalLayout4Col(6, 2)
    // 6 singles + 2 doubles/triples = 8 cards
    expect(layout.cards.length).toBe(8)
    // All ids are unique
    const ids = layout.cards.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("handles zero doubles", () => {
    const layout = findOptimalLayout4Col(4, 0)
    expect(layout.cards.length).toBe(4)
    expect(layout.cards.every((c) => c.type === "single" || c.type === "fixed")).toBe(true)
  })

  it("columns stay within 1-indexed bounds", () => {
    for (let s = 3; s <= 12; s++) {
      for (let d = 0; d <= 4; d++) {
        const layout = findOptimalLayout4Col(s, d)
        for (const card of layout.cards) {
          expect(card.col).toBeGreaterThanOrEqual(1)
          expect(card.col).toBeLessThanOrEqual(layout.cols)
        }
      }
    }
  })

  it("rows are 1-indexed and sequential", () => {
    for (let s = 3; s <= 12; s++) {
      for (let d = 0; d <= 4; d++) {
        const layout = findOptimalLayout4Col(s, d)
        for (const card of layout.cards) {
          expect(card.row).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it("total card count equals S + D for all inputs", () => {
    for (let s = 3; s <= 12; s++) {
      for (let d = 0; d <= 4; d++) {
        const layout = findOptimalLayout4Col(s, d)
        expect(layout.cards.length).toBe(s + d)
      }
    }
  })

  it("no overlapping grid positions across a wide range of inputs", () => {
    for (let s = 3; s <= 12; s++) {
      for (let d = 0; d <= 4; d++) {
        const layout = findOptimalLayout4Col(s, d)
        const occupied = new Set<string>()
        for (const card of layout.cards) {
          for (let r = card.row; r < card.row + card.span; r++) {
            const key = `${r},${card.col}`
            expect(occupied.has(key)).toBe(false)
            occupied.add(key)
          }
        }
      }
    }
  })
})

// ============================================
// 3-COLUMN BREAKPOINT
// ============================================

describe("findOptimalLayout3Col", () => {
  // Case 1: 4S+0D → 0T, 2 gaps (unavoidable: 4 cards cannot fill 3-col rows perfectly)
  it("case 1: 4S+0D → 0T, 2 gaps", () => {
    const r = findOptimalLayout3Col(4, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(2)
  })

  // Case 2: 5S+0D → 0T, last-empty (1 gap in last row)
  it("case 2: 5S+0D → 0T, last-empty", () => {
    const r = findOptimalLayout3Col(5, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(1)
    expect(r.lastEmpty).toBe(true)
  })

  // Case 3: 6S+0D → 0T, perfect
  it("case 3: 6S+0D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(6, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 4: 4S+1D → 0T, 3 gaps (row-1-singles constraint leaves double alone)
  it("case 4: 4S+1D → 0T, 3 gaps", () => {
    const r = findOptimalLayout3Col(4, 1)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(3)
  })

  // Case 5: 6S+1D → 0T, last-empty (row-1-singles: no promotion needed, 1 gap in last row)
  it("case 5: 6S+1D → 0T, last-empty", () => {
    const r = findOptimalLayout3Col(6, 1)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(1)
    expect(r.lastEmpty).toBe(true)
  })

  // Case 6: 5S+2D → 0T, perfect
  it("case 6: 5S+2D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(5, 2)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 7: 8S+2D → 0T, perfect
  it("case 7: 8S+2D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(8, 2)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 8: 7S+1D → 0T, perfect
  it("case 8: 7S+1D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(7, 1)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 9: 11S+3D → 1T, perfect (promoting 1 achieves 0 gaps)
  it("case 9: 11S+3D → 1T, perfect", () => {
    const r = findOptimalLayout3Col(11, 3)
    expect(r.triples).toBe(1)
    expect(r.gaps).toBe(0)
  })

  // Case 10: 13S+4D → 0T, perfect
  it("case 10: 13S+4D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(13, 4)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 11: 13S+5D → 1T, perfect (promoting 1 achieves 0 gaps)
  it("case 11: 13S+5D → 1T, perfect", () => {
    const r = findOptimalLayout3Col(13, 5)
    expect(r.triples).toBe(1)
    expect(r.gaps).toBe(0)
  })

  // Case 12: 3S+0D → 0T, perfect
  it("case 12: 3S+0D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(3, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 13: 3S+1D → 0T, 4 gaps (3 singles fill row 1, double alone in next block)
  it("case 13: 3S+1D → 0T, 4 gaps", () => {
    const r = findOptimalLayout3Col(3, 1)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(4)
  })

  // Case 14: 3S+2D → 0T, 2 gaps (3 singles fill row 1, 2 doubles side-by-side leave col 3 empty)
  it("case 14: 3S+2D → 0T, 2 gaps", () => {
    const r = findOptimalLayout3Col(3, 2)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(2)
  })

  // Case 15: 9S+0D → 0T, perfect
  it("case 15: 9S+0D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(9, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 16: 13S+0D → 0T, 2 gaps (no doubles to promote; unavoidable)
  it("case 16: 13S+0D → 0T, 2 gaps", () => {
    const r = findOptimalLayout3Col(13, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(2)
  })

  // Case 17: 7S+4D → 0T, perfect
  it("case 17: 7S+4D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(7, 4)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 18: 6S+3D → 0T, perfect
  it("case 18: 6S+3D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(6, 3)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 19: 9S+3D → 0T, perfect
  it("case 19: 9S+3D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(9, 3)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 20: 10S+2D → 1T, perfect
  it("case 20: 10S+2D → 1T, perfect", () => {
    const r = findOptimalLayout3Col(10, 2)
    expect(r.triples).toBe(1)
    expect(r.gaps).toBe(0)
  })

  // Case 21: 8S+4D → 2T, perfect (promoting 2 achieves 0 gaps)
  it("case 21: 8S+4D → 2T, perfect", () => {
    const r = findOptimalLayout3Col(8, 4)
    expect(r.triples).toBe(2)
    expect(r.gaps).toBe(0)
  })

  // Case 22: 10S+4D → 0T, perfect
  it("case 22: 10S+4D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(10, 4)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 23: 15S+3D → 0T, perfect
  it("case 23: 15S+3D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(15, 3)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 24: 20S+4D → 2T, perfect (promoting 2 achieves 0 gaps)
  it("case 24: 20S+4D → 2T, perfect", () => {
    const r = findOptimalLayout3Col(20, 4)
    expect(r.triples).toBe(2)
    expect(r.gaps).toBe(0)
  })

  // Case 25: 6S+6D → 0T, perfect
  it("case 25: 6S+6D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(6, 6)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 26: 4S+4D → 0T, 3 gaps (row-1-singles constraint)
  it("case 26: 4S+4D → 0T, 3 gaps", () => {
    const r = findOptimalLayout3Col(4, 4)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(3)
  })

  // Case 27: 4S+5D → 0T, last-empty
  it("case 27: 4S+5D → 0T, last-empty", () => {
    const r = findOptimalLayout3Col(4, 5)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(1)
    expect(r.lastEmpty).toBe(true)
  })

  // Case 28: 4S+7D → 0T, 3 gaps
  it("case 28: 4S+7D → 0T, 3 gaps", () => {
    const r = findOptimalLayout3Col(4, 7)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(3)
  })

  // Case 29: 7S+7D → 0T, perfect
  it("case 29: 7S+7D → 0T, perfect", () => {
    const r = findOptimalLayout3Col(7, 7)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Case 30: 4S+10D → 0T, 3 gaps
  it("case 30: 4S+10D → 0T, 3 gaps", () => {
    const r = findOptimalLayout3Col(4, 10)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(3)
  })

  // General invariant: triples never exceeds doubles count
  it("triples never exceeds doubles count", () => {
    for (let s = 0; s <= 15; s++) {
      for (let d = 0; d <= 8; d++) {
        const r = findOptimalLayout3Col(s, d)
        expect(r.triples).toBeGreaterThanOrEqual(0)
        expect(r.triples).toBeLessThanOrEqual(d)
      }
    }
  })
})

describe("findOptimalLayout3Col.cards (placement)", () => {
  it("places all cards without overlap (8S+2D)", () => {
    const layout = findOptimalLayout3Col(8, 2)
    expect(layout.cards.length).toBe(10)

    const occupied = new Set<string>()
    for (const card of layout.cards) {
      for (let r = card.row; r < card.row + card.span; r++) {
        const key = `${r},${card.col}`
        expect(occupied.has(key)).toBe(false)
        occupied.add(key)
      }
    }
  })

  it("all card ids are unique (6S+3D)", () => {
    const layout = findOptimalLayout3Col(6, 3)
    const ids = layout.cards.map((c) => c.id)
    expect(ids.length).toBe(9)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("returns correct type for promoted doubles (11S+3D → 1T)", () => {
    const layout = findOptimalLayout3Col(11, 3)
    expect(layout.triples).toBe(1)

    const triples = layout.cards.filter((c) => c.type === "triple")
    const doubles = layout.cards.filter((c) => c.type === "double")
    expect(triples.length).toBe(1)
    expect(doubles.length).toBe(2)
    expect(triples[0].span).toBe(3)
    expect(doubles[0].span).toBe(2)
  })

  it("total card count equals S + D for all inputs", () => {
    for (let s = 0; s <= 12; s++) {
      for (let d = 0; d <= 6; d++) {
        const layout = findOptimalLayout3Col(s, d)
        expect(layout.cards.length).toBe(s + d)
      }
    }
  })

  it("no overlapping grid positions across a wide range of inputs", () => {
    for (let s = 0; s <= 12; s++) {
      for (let d = 0; d <= 6; d++) {
        const layout = findOptimalLayout3Col(s, d)
        const occupied = new Set<string>()
        for (const card of layout.cards) {
          for (let r = card.row; r < card.row + card.span; r++) {
            const key = `${r},${card.col}`
            expect(occupied.has(key)).toBe(false)
            occupied.add(key)
          }
        }
      }
    }
  })

  it("columns always stay within bounds (1-3)", () => {
    for (let s = 0; s <= 12; s++) {
      for (let d = 0; d <= 6; d++) {
        const layout = findOptimalLayout3Col(s, d)
        for (const card of layout.cards) {
          expect(card.col).toBeGreaterThanOrEqual(1)
          expect(card.col).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it("handles empty input", () => {
    const layout = findOptimalLayout3Col(0, 0)
    expect(layout.cards.length).toBe(0)
  })

  it("handles singles only", () => {
    const layout = findOptimalLayout3Col(6, 0)
    expect(layout.cards.length).toBe(6)
    expect(layout.cards.every((c) => c.type === "single" || c.type === "fixed")).toBe(true)
  })

  it("handles doubles only", () => {
    const layout = findOptimalLayout3Col(0, 4)
    expect(layout.cards.length).toBe(4)
    expect(layout.cards.every((c) => c.type === "double" || c.type === "triple")).toBe(true)
  })
})

// ============================================
// 2-COLUMN BREAKPOINT
// ============================================

describe("findOptimalLayout2Col", () => {
  // Even total: no promotion needed
  it("case 1: 2S+0D → 0T, 0 gaps", () => {
    const r = findOptimalLayout2Col(2, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  it("case 2: 4S+0D → 0T, 0 gaps", () => {
    const r = findOptimalLayout2Col(4, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Odd total, no doubles to promote → orphan
  it("case 3: 3S+0D → 0T, orphan", () => {
    const r = findOptimalLayout2Col(3, 0)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(1)
    expect(r.orphan).toBe(true)
  })

  // Even total with doubles
  it("case 4: 8S+1D → 0T, 0 gaps", () => {
    const r = findOptimalLayout2Col(8, 1)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  it("case 5: 8S+2D → 0T, 0 gaps", () => {
    const r = findOptimalLayout2Col(8, 2)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  it("case 6: 8S+3D → 0T, 0 gaps", () => {
    const r = findOptimalLayout2Col(8, 3)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  it("case 7: 8S+4D → 0T, 0 gaps", () => {
    const r = findOptimalLayout2Col(8, 4)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // Odd total with doubles → promotes 1
  it("case 8: 9S+1D → 1T, 0 gaps", () => {
    const r = findOptimalLayout2Col(9, 1)
    expect(r.triples).toBe(1)
    expect(r.gaps).toBe(0)
  })

  it("case 9: 9S+2D → 1T, 0 gaps", () => {
    const r = findOptimalLayout2Col(9, 2)
    expect(r.triples).toBe(1)
    expect(r.gaps).toBe(0)
  })

  it("case 10: 10S+3D → 0T, 0 gaps", () => {
    const r = findOptimalLayout2Col(10, 3)
    expect(r.triples).toBe(0)
    expect(r.gaps).toBe(0)
  })

  // General invariants
  it("cols is always 2", () => {
    for (let s = 0; s <= 15; s++) {
      for (let d = 0; d <= 6; d++) {
        const r = findOptimalLayout2Col(s, d)
        expect(r.cols).toBe(2)
      }
    }
  })

  it("triples is 0 or 1", () => {
    for (let s = 0; s <= 15; s++) {
      for (let d = 0; d <= 6; d++) {
        const r = findOptimalLayout2Col(s, d)
        expect(r.triples).toBeLessThanOrEqual(1)
        expect(r.triples).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("triples never exceeds doubles count", () => {
    for (let s = 0; s <= 15; s++) {
      for (let d = 0; d <= 6; d++) {
        const r = findOptimalLayout2Col(s, d)
        expect(r.triples).toBeLessThanOrEqual(d)
      }
    }
  })
})

describe("findOptimalLayout2Col.cards (placement)", () => {
  it("places all cards without overlap (8S+2D)", () => {
    const layout = findOptimalLayout2Col(8, 2)
    expect(layout.cards.length).toBe(10)

    const occupied = new Set<string>()
    for (const card of layout.cards) {
      for (let r = card.row; r < card.row + card.span; r++) {
        const key = `${r},${card.col}`
        expect(occupied.has(key)).toBe(false)
        occupied.add(key)
      }
    }
  })

  it("first 2 cards are fixed in row 1", () => {
    const layout = findOptimalLayout2Col(8, 2)
    const fixed = layout.cards.filter((c) => c.type === "fixed")
    expect(fixed.length).toBe(2)
    expect(fixed[0].row).toBe(1)
    expect(fixed[0].col).toBe(1)
    expect(fixed[1].row).toBe(1)
    expect(fixed[1].col).toBe(2)
  })

  it("promoted double becomes triple with span 3", () => {
    const layout = findOptimalLayout2Col(9, 1)
    expect(layout.triples).toBe(1)

    const triples = layout.cards.filter((c) => c.type === "triple")
    expect(triples.length).toBe(1)
    expect(triples[0].span).toBe(3)
  })

  it("doubles are paired side-by-side", () => {
    const layout = findOptimalLayout2Col(8, 4)
    const doubles = layout.cards.filter((c) => c.type === "double")
    expect(doubles.length).toBe(4)

    // Doubles should be in pairs: same row, cols 1 and 2
    for (let i = 0; i < doubles.length; i += 2) {
      expect(doubles[i].row).toBe(doubles[i + 1].row)
      expect(doubles[i].col).toBe(1)
      expect(doubles[i + 1].col).toBe(2)
    }
  })

  it("total card count equals S + D for all inputs", () => {
    for (let s = 0; s <= 12; s++) {
      for (let d = 0; d <= 6; d++) {
        const layout = findOptimalLayout2Col(s, d)
        expect(layout.cards.length).toBe(s + d)
      }
    }
  })

  it("no overlapping grid positions across a wide range of inputs", () => {
    for (let s = 0; s <= 12; s++) {
      for (let d = 0; d <= 6; d++) {
        const layout = findOptimalLayout2Col(s, d)
        const occupied = new Set<string>()
        for (const card of layout.cards) {
          for (let r = card.row; r < card.row + card.span; r++) {
            const key = `${r},${card.col}`
            expect(occupied.has(key)).toBe(false)
            occupied.add(key)
          }
        }
      }
    }
  })

  it("columns always stay within bounds (1-2)", () => {
    for (let s = 0; s <= 12; s++) {
      for (let d = 0; d <= 6; d++) {
        const layout = findOptimalLayout2Col(s, d)
        for (const card of layout.cards) {
          expect(card.col).toBeGreaterThanOrEqual(1)
          expect(card.col).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  it("all card ids are unique across a wide range of inputs", () => {
    for (let s = 0; s <= 12; s++) {
      for (let d = 0; d <= 6; d++) {
        const layout = findOptimalLayout2Col(s, d)
        const ids = layout.cards.map((c) => c.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it("handles empty input", () => {
    const layout = findOptimalLayout2Col(0, 0)
    expect(layout.cards.length).toBe(0)
    expect(layout.gaps).toBe(0)
  })

  it("handles singles only", () => {
    const layout = findOptimalLayout2Col(6, 0)
    expect(layout.cards.length).toBe(6)
    expect(layout.cards.every((c) => c.type === "single" || c.type === "fixed")).toBe(true)
    expect(layout.gaps).toBe(0)
  })
})

// ============================================
// getCardClasses
// ============================================

describe("getCardClasses", () => {
  it("returns correct classes for a basic card", () => {
    const classes = getCardClasses({ id: "s1", type: "single", row: 1, col: 1, span: 1 })
    expect(classes).toContain("row-start-1")
    expect(classes).toContain("col-start-1")
    expect(classes).toContain("row-span-1")
  })

  it("returns correct classes for a double-height card", () => {
    const classes = getCardClasses({ id: "d1", type: "double", row: 3, col: 2, span: 2 })
    expect(classes).toContain("row-start-3")
    expect(classes).toContain("col-start-2")
    expect(classes).toContain("row-span-2")
  })

  it("returns correct classes for a triple-height card", () => {
    const classes = getCardClasses({ id: "t1", type: "triple", row: 2, col: 4, span: 3 })
    expect(classes).toContain("row-start-2")
    expect(classes).toContain("col-start-4")
    expect(classes).toContain("row-span-3")
  })

  it("returns valid classes for all rows up to 30", () => {
    for (let row = 1; row <= 30; row++) {
      const classes = getCardClasses({ id: "s1", type: "single", row, col: 1, span: 1 })
      expect(classes).toContain(`row-start-${row}`)
    }
  })

  it("returns empty row-start for rows beyond 30", () => {
    const classes = getCardClasses({ id: "s1", type: "single", row: 31, col: 1, span: 1 })
    expect(classes).not.toContain("row-start-31")
    expect(classes).toContain("col-start-1")
  })

  it("returns valid classes for all columns 1-4", () => {
    for (let col = 1; col <= 4; col++) {
      const classes = getCardClasses({ id: "s1", type: "single", row: 1, col, span: 1 })
      expect(classes).toContain(`col-start-${col}`)
    }
  })

  it("produces correct classes for real layout output", () => {
    const layout = findOptimalLayout4Col(8, 2)
    for (const card of layout.cards) {
      const classes = getCardClasses(card)
      expect(classes).toContain(`row-start-${card.row}`)
      expect(classes).toContain(`col-start-${card.col}`)
      expect(classes).toContain(`row-span-${card.span}`)
    }
  })
})
