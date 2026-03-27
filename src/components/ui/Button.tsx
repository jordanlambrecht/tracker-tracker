// src/components/ui/Button.tsx

import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { ButtonHTMLAttributes, Ref } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "minimal"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  ref?: Ref<HTMLButtonElement>
}

const button = cva(
  [
    "inline-flex items-center justify-center font-sans font-medium",
    "transition-all duration-150 cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base",
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent-dim text-accent nm-raised-sm hover:nm-raised active:nm-pressed active:scale-[0.93]",
        secondary:
          "bg-raised text-primary nm-raised-sm hover:nm-raised active:nm-pressed active:scale-[0.93]",
        ghost:
          "bg-transparent text-secondary hover:bg-raised hover:text-primary hover:nm-raised-sm active:scale-[0.96]",
        danger:
          "bg-danger-dim text-danger nm-raised-sm hover:nm-raised active:nm-pressed active:scale-[0.93]",
        minimal:
          "bg-transparent text-muted hover:text-secondary",
      },
      size: {
        sm: "px-4 py-2 text-xs gap-2 rounded-nm-sm",
        md: "px-5 py-2 text-sm gap-2 rounded-nm-md",
        lg: "px-6 py-3 text-base gap-3 rounded-nm-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  children,
  style,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={clsx(button({ variant, size }), className)}
      style={style}
      {...props}
    >
      {children}
    </button>
  )
}

export type { ButtonProps, ButtonSize, ButtonVariant }
export { Button, button as buttonVariants }
