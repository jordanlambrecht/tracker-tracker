// src/components/ui/Table.tsx
//
// Functions: Table

"use client"

import { useAutoAnimate } from "@formkit/auto-animate/react"
import clsx from "clsx"
import type { CSSProperties, ReactNode } from "react"
import { useCallback, useState } from "react"
import { Card } from "./Card"

type TableSurface = "inset" | "raised" | "flat"
type SortDirection = "asc" | "desc"

interface Column<T> {
  key: string
  header: string
  align?: "left" | "right"
  width?: number | string
  sortable?: boolean
  sortValue?: (item: T) => number | string
  render: (item: T, index: number) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  emptyMessage?: string
  surface?: TableSurface
  className?: string
  onRowClick?: (item: T) => void
  rowStyle?: (item: T) => CSSProperties | undefined
  defaultSortKey?: string
  defaultSortDirection?: SortDirection
  fixedLayout?: boolean
  compact?: boolean
  maxHeight?: number
  alwaysShowScrollbar?: boolean
  animated?: boolean
  noHorizontalScroll?: boolean
}

const thBase = "px-5 py-3 text-xs font-sans font-medium text-secondary uppercase tracking-wider"

const thSortable = "cursor-pointer hover:text-primary transition-colors duration-150 select-none"

const surfaceClasses: Record<TableSurface, string> = {
  inset: "nm-inset-sm",
  raised: "nm-raised-sm",
  flat: "",
}

function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data",
  surface = "inset",
  className,
  onRowClick,
  rowStyle,
  defaultSortKey,
  defaultSortDirection = "desc",
  fixedLayout = false,
  compact = false,
  maxHeight,
  alwaysShowScrollbar = false,
  animated = false,
  noHorizontalScroll = false,
}: TableProps<T>) {
  const [animateRef] = useAutoAnimate({ duration: 250, easing: "ease-out" })
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null)
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortDirection)

  const hasSorting = columns.some((c) => c.sortable)

  const handleSort = useCallback(
    (key: string) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortDir("desc")
      }
    },
    [sortKey]
  )

  const sortedData = (() => {
    if (!hasSorting || !sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return data

    const sortFn = col.sortValue
    return [...data].sort((a, b) => {
      const aVal = sortFn(a)
      const bVal = sortFn(b)
      const cmp =
        typeof aVal === "string" && typeof bVal === "string"
          ? aVal.localeCompare(bVal)
          : (aVal as number) - (bVal as number)
      return sortDir === "asc" ? cmp : -cmp
    })
  })()

  return (
    <Card
      elevation="raised"
      className={clsx(
        "!p-0 overflow-hidden",
        sortedData.length === 0 && "flex flex-col",
        className
      )}
    >
      <div
        className={clsx(
          surfaceClasses[surface],
          "overflow-hidden rounded-nm-lg",
          !noHorizontalScroll && "overflow-x-auto",
          noHorizontalScroll && "pr-1",
          maxHeight && "overflow-y-auto overscroll-contain",
          maxHeight && (alwaysShowScrollbar ? "styled-scrollbar-visible" : "styled-scrollbar"),
          sortedData.length === 0 && "flex-1 flex items-center justify-center"
        )}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {sortedData.length > 0 ? (
          <table className={clsx("w-full text-left", fixedLayout && "table-fixed")}>
            <thead className={maxHeight ? "sticky top-0 z-10 bg-elevated" : undefined}>
              <tr className="border-b border-border-emphasis">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={clsx(
                      compact
                        ? "px-3 py-2.5 text-xs font-sans font-medium text-secondary uppercase tracking-wider"
                        : thBase,
                      col.align === "right" && "text-right",
                      col.sortable && thSortable
                    )}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="ml-1 text-accent">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={animated ? animateRef : undefined}>
              {sortedData.map((item, i) => (
                <tr
                  key={keyExtractor(item)}
                  className={clsx(
                    i < sortedData.length - 1 && "border-b border-border",
                    onRowClick && "cursor-pointer hover:bg-elevated transition-colors duration-150"
                  )}
                  style={rowStyle?.(item)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        compact ? "px-3 py-2.5" : "px-5 py-3",
                        col.align === "right" && "text-right",
                        fixedLayout && "overflow-hidden"
                      )}
                    >
                      {col.render(item, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm font-mono text-muted py-8">{emptyMessage}</p>
        )}
      </div>
    </Card>
  )
}

export type { Column, SortDirection, TableProps, TableSurface }
export { Table }
