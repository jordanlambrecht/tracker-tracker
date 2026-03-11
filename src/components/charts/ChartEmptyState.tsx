// src/components/charts/ChartEmptyState.tsx

interface ChartEmptyStateProps {
  height: string | number
  message?: string
}

function ChartEmptyState({ height, message = "No data available" }: ChartEmptyStateProps) {
  return (
    <div
      className="flex items-center justify-center text-tertiary font-mono text-sm"
      style={{ height }}
    >
      {message}
    </div>
  )
}

export { ChartEmptyState }
export type { ChartEmptyStateProps }
