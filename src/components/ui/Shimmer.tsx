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

export { Shimmer, shimmerVariants }
export type { ShimmerProps }
