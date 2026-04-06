// src/components/ui/Notice.tsx

import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { ReactElement, ReactNode } from "react"
import { CheckLargeIcon, InfoIcon, TriangleWarningIcon } from "@/components/ui/Icons"

type NoticeVariant = "danger" | "warn" | "success" | "info" | "default"

interface NoticeProps {
  message?: string | null
  header?: string
  variant?: NoticeVariant
  box?: boolean
  showIcon?: boolean
  icon?: ReactElement
  children?: ReactNode
  className?: string
}

const notice = cva("text-xs font-sans", {
  variants: {
    variant: {
      danger: "text-danger",
      warn: "text-warn",
      success: "text-success",
      info: "text-accent",
      default: "text-secondary",
    },
    box: {
      true: "nm-inset-sm rounded-nm-md border px-4 py-3",
      false: "",
    },
  },
  compoundVariants: [
    { variant: "danger", box: true, class: "bg-danger/5 border-danger/20" },
    { variant: "warn", box: true, class: "bg-warn/5 border-warn/20" },
    { variant: "success", box: true, class: "bg-success/5 border-success/20" },
    { variant: "info", box: true, class: "bg-accent/5 border-accent/20" },
    { variant: "default", box: true, class: "bg-control-bg border-border" },
  ],
  defaultVariants: {
    variant: "danger",
    box: false,
  },
})

const defaultIcon: Record<NoticeVariant, ReactNode> = {
  danger: <TriangleWarningIcon width="14" height="14" className="shrink-0" />,
  warn: <TriangleWarningIcon width="14" height="14" className="shrink-0" />,
  success: <CheckLargeIcon width="14" height="14" className="shrink-0" />,
  info: <InfoIcon width="14" height="14" className="shrink-0" />,
  default: <InfoIcon width="14" height="14" className="shrink-0" />,
}

function Notice({
  message,
  header,
  variant = "danger",
  box = false,
  showIcon,
  icon,
  children,
  className,
}: NoticeProps) {
  const body = children ?? message
  if (!body && !header) return null

  const iconVisible = showIcon ?? (icon !== undefined || box)
  const iconElement = iconVisible ? (icon ?? defaultIcon[variant]) : null

  return (
    <div
      className={clsx(notice({ variant, box }), iconElement && "flex gap-2", className)}
      role={
        variant === "danger"
          ? "alert"
          : variant === "info" || variant === "default"
            ? "note"
            : "status"
      }
    >
      {iconElement && <span className="mt-px">{iconElement}</span>}
      {header && !body ? (
        <span className="font-medium">{header}</span>
      ) : header ? (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{header}</span>
          <span className="text-secondary">{body}</span>
        </div>
      ) : (
        body
      )}
    </div>
  )
}

export type { NoticeProps, NoticeVariant }
export { Notice }
