// src/components/ui/Shimmer.tsx

import { cva, type VariantProps } from "class-variance-authority"
import clsx from "clsx"

const shimmerVariants = cva("bg-control-bg animate-pulse", {
  variants: {
    rounded: {
      sm: "rounded-nm-sm",
      md: "rounded-nm-md",
      full: "rounded-full",
    },
    size: {
      label: "h-2.5",
      text: "h-3",
      bar: "h-4",
      heading: "h-5",
      value: "h-8",
    },
  },
  defaultVariants: {
    rounded: "sm",
  },
})

type ShimmerProps = VariantProps<typeof shimmerVariants> & {
  className?: string
}

function Shimmer({ size, rounded, className }: ShimmerProps) {
  return <div className={clsx(shimmerVariants({ size, rounded }), className)} />
}

/** Chart-shaped shimmer  */
function ChartShimmer({
  height = "h-[360px]",
  className,
}: {
  height?: string
  className?: string
}) {
  return (
    <div className={clsx("flex flex-col gap-3", height, className)}>
      {/* Legend dots */}
      <div className="flex gap-3 px-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`leg-${i}`} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-control-bg animate-pulse" />
            <div className="h-2 w-12 bg-control-bg animate-pulse rounded-nm-sm" />
          </div>
        ))}
      </div>
      {/* Chart area with y-axis + bars */}
      <div className="flex-1 flex gap-2">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between py-2 shrink-0">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={`y-${i}`} className="h-2 w-8 bg-control-bg animate-pulse rounded-nm-sm" />
          ))}
        </div>
        {/* Chart bars/area */}
        <div className="flex-1 flex items-end gap-1 pb-6">
          {Array.from({ length: 20 }, (_, i) => {
            const h = [
              35, 55, 45, 70, 60, 80, 50, 65, 75, 40, 55, 85, 70, 45, 60, 90, 50, 75, 65, 55,
            ][i]
            return (
              <div
                key={`bar-${i}`}
                className="flex-1 bg-control-bg animate-pulse rounded-t-sm"
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex justify-between pl-10">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={`x-${i}`} className="h-2 w-10 bg-control-bg animate-pulse rounded-nm-sm" />
        ))}
      </div>
    </div>
  )
}

export type { ShimmerProps }
export { ChartShimmer, Shimmer, shimmerVariants }
