// src/components/ui/PillTag.tsx

import { cva, type VariantProps } from "class-variance-authority"
import clsx from "clsx"
import type { HTMLAttributes } from "react"

const pillTagVariants = cva("nm-inset-sm bg-control-bg rounded-nm-pill font-mono", {
  variants: {
    color: {
      accent: "text-accent",
      danger: "text-danger",
      secondary: "text-secondary",
      tertiary: "text-tertiary",
      muted: "text-muted",
    },
    size: {
      sm: "px-1.5 py-0.5 text-3xs",
      md: "px-3 py-1 text-xs",
    },
  },
  defaultVariants: { color: "tertiary", size: "md" },
})

type PillTagColor = NonNullable<VariantProps<typeof pillTagVariants>["color"]>

interface PillTagProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "color">, VariantProps<typeof pillTagVariants> {
  label?: string
}

function PillTag({ color, size, label, className, children, ...props }: PillTagProps) {
  return (
    <span className={clsx(pillTagVariants({ color, size }), className)} {...props}>
      {label ?? children}
    </span>
  )
}

export type { PillTagColor, PillTagProps }
export { PillTag }
