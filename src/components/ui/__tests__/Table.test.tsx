// src/components/ui/__tests__/Table.test.tsx
//
// Regression coverage: sortValue can legitimately return Infinity (e.g. an
// infinite ratio — see TrackerLeaderboard). Two equal Infinity values used
// to subtract to NaN, which is not a valid Array.prototype.sort comparator
// result and left ordering unspecified.

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"

interface Row {
  id: number
  name: string
  value: number
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "value", header: "Value", sortable: true, sortValue: (r) => r.value, render: (r) => r.value },
]

describe("Table sorting with non-finite sortValues", () => {
  it("keeps two Infinity rows in their original relative order instead of throwing off the sort", () => {
    const data: Row[] = [
      { id: 1, name: "First", value: Number.POSITIVE_INFINITY },
      { id: 2, name: "Second", value: Number.POSITIVE_INFINITY },
      { id: 3, name: "Third", value: 5 },
    ]

    render(
      <Table<Row>
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        defaultSortKey="value"
        defaultSortDirection="desc"
      />
    )

    const rows = screen.getAllByRole("row").slice(1) // drop the header row
    const names = rows.map((r) => within(r).getAllByRole("cell")[0].textContent)
    // Both Infinity rows sort ahead of the finite one, and NaN from the
    // subtraction doesn't scramble their relative order.
    expect(names).toEqual(["First", "Second", "Third"])
  })
})
