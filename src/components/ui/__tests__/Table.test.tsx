// src/components/ui/__tests__/Table.test.tsx
//
// Regression coverage: sortValue can return Infinity (an infinite ratio, see
// TrackerLeaderboard). An infinite value sorts ahead of a finite one, and tied
// infinite rows keep their input order.

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
  {
    key: "value",
    header: "Value",
    sortable: true,
    sortValue: (r) => r.value,
    render: (r) => r.value,
  },
]

describe("Table sorting with non-finite sortValues", () => {
  it("sorts infinite values ahead of finite ones and keeps tied rows in input order", () => {
    // Finite row first so a descending sort has to move it to the end. If this
    // fixture were pre-sorted the assertion below would hold even with no sorting.
    const data: Row[] = [
      { id: 3, name: "Third", value: 5 },
      { id: 1, name: "First", value: Number.POSITIVE_INFINITY },
      { id: 2, name: "Second", value: Number.POSITIVE_INFINITY },
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
