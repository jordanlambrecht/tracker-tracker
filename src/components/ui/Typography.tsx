// src/components/ui/Typography.tsx
//
// Functions: H1, H2, H3, Subheader, Paragraph, Subtext

import type { HTMLAttributes } from "react"
import clsx from "clsx"

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  as?: keyof HTMLElementTagNameMap
}

/** Page title — used once per page */
function H1({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={clsx("text-lg font-sans font-bold text-primary", className)} {...props}>
      {children}
    </h1>
  )
}

/** Section label — uppercase, small, used above Cards to name sections */
function H2({ className, children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      id={id}
      className={clsx("text-xs font-sans font-medium text-secondary uppercase tracking-wider", className)}
      {...props}
    >
      {children}
    </h2>
  )
}

/** Sub-section heading — used inside Cards to name feature groups */
function H3({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx("text-sm font-sans font-semibold text-primary", className)} {...props}>
      {children}
    </h3>
  )
}

/** Supporting heading — secondary label below or beside a heading */
function Subheader({ as: Tag = "span", className, children, ...props }: TypographyProps) {
  return (
    <Tag className={clsx("text-xs font-sans font-medium text-secondary", className)} {...props}>
      {children}
    </Tag>
  )
}

/** Description text — explanations, help text */
function Paragraph({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx("text-xs font-sans text-tertiary leading-relaxed", className)} {...props}>
      {children}
    </p>
  )
}

/** Fine print — warnings, disclaimers, footnotes */
function Subtext({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx("text-xs font-sans text-muted leading-relaxed", className)} {...props}>
      {children}
    </p>
  )
}

export { H1, H2, H3, Subheader, Paragraph, Subtext }
