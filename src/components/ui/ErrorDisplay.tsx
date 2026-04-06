// src/components/ui/ErrorDisplay.tsx
"use client"

import { H1 } from "@typography"
import clsx from "clsx"
import Link from "next/link"
import { CopyButton } from "@/components/ui/ActionButtons"
import { Button, buttonVariants } from "@/components/ui/Button"
import { Tooltip } from "@/components/ui/Tooltip"

export function ErrorDisplay({
  message,
  onRetry,
  linkHref,
  linkText,
}: {
  message: string
  onRetry: () => void
  linkHref: string
  linkText: string
}) {
  const errorText = message || "An unexpected error occurred."

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="w-full max-w-md bg-elevated p-8 nm-raised-lg rounded-nm-xl">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-danger">
          Runtime Error
        </p>
        <H1 className="mb-4 text-xl font-semibold">Something went wrong</H1>
        <div className="relative mb-6">
          <pre className="bg-control-bg p-3 pr-10 font-mono text-xs text-secondary nm-inset whitespace-pre-wrap break-all rounded-nm-md">
            {errorText}
          </pre>
          <Tooltip content="Copy error message">
            <CopyButton
              value={errorText}
              className="absolute top-2 right-2 p-1.5 text-muted hover:text-secondary transition-colors duration-150 cursor-pointer"
            />
          </Tooltip>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" size="sm" onClick={onRetry} text="Try Again" />
          <Link
            href={linkHref}
            className={clsx(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-nm-sm")}
          >
            {linkText}
          </Link>
        </div>
      </div>
    </div>
  )
}
