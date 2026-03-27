// src/components/ui/Typography.tsx
//
// Functions: H1, H2, H3, Subheader, Paragraph, Subtext, SlotLabel, DataCell

import clsx from "clsx"
import type { HTMLAttributes } from "react"

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  as?: keyof HTMLElementTagNameMap
}

function H1({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={clsx("text-lg font-sans font-bold text-primary", className)} {...props}>
      {children}
    </h1>
  )
}

function H2({ className, children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      id={id}
      className={clsx(
        "text-xs font-sans font-medium text-secondary uppercase tracking-wider",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  )
}

function H3({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx("text-sm font-sans font-semibold text-primary", className)} {...props}>
      {children}
    </h3>
  )
}

function Subheader({ as: Tag = "span", className, children, ...props }: TypographyProps) {
  return (
    <Tag className={clsx("text-xs font-sans font-medium text-secondary", className)} {...props}>
      {children}
    </Tag>
  )
}

function Paragraph({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx("text-xs font-sans text-tertiary leading-relaxed", className)} {...props}>
      {children}
    </p>
  )
}

/** Fine print: warnings, disclaimers, footnotes */
function Subtext({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx("text-xs font-sans text-muted leading-relaxed", className)} {...props}>
      {children}
    </p>
  )
}

/** uppercase micro text for slot names, field labels in dense UI */
function SlotLabel({
  label,
  className,
  children,
  ...props
}: { label?: string } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={clsx("slot-label", className)} {...props}>
      {label ?? children}
    </span>
  )
}

/** Mono tabular-nums value for leaderboard/table cells */
function DataCell({
  value,
  className,
  children,
  ...props
}: { value?: string } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={clsx("tabular-cell", className)} {...props}>
      {value ?? children}
    </span>
  )
}

export { DataCell, H1, H2, H3, Paragraph, SlotLabel, Subheader, Subtext }
