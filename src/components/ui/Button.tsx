// src/components/ui/Button.tsx
import { type ButtonHTMLAttributes, forwardRef } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-accent-dim text-accent border border-accent",
    "hover:bg-accent hover:text-base hover:shadow-glow",
    "active:scale-[0.98]",
    "shadow-glow-sm",
  ].join(" "),
  secondary: [
    "bg-raised text-primary border border-border",
    "hover:bg-elevated hover:border-border-emphasis",
    "active:scale-[0.98]",
  ].join(" "),
  ghost: [
    "bg-transparent text-secondary border border-transparent",
    "hover:bg-raised hover:text-primary hover:border-border",
    "active:scale-[0.98]",
  ].join(" "),
  danger: [
    "bg-danger-dim text-danger border border-danger",
    "hover:bg-danger hover:text-base hover:shadow-glow-danger",
    "active:scale-[0.98]",
    "shadow-glow-danger",
  ].join(" "),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-sm gap-1.5",
  md: "px-4 py-2 text-sm rounded-md gap-2",
  lg: "px-6 py-3 text-base rounded-lg gap-2.5",
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      className = "",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center font-sans font-medium",
          "transition-all duration-150 cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = "Button"

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
