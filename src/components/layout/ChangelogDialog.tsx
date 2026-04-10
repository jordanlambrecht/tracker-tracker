// src/components/layout/ChangelogDialog.tsx

"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { Dialog, Shimmer } from "@/components/ui"

const ChangelogContent = dynamic(() => import("./ChangelogContent"), { ssr: false })

interface ChangelogDialogProps {
  open: boolean
  onClose: () => void
}

export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    if (!open || content !== null) return

    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data: { content: string }) => setContent(data.content))
      .catch(() => setContent("Failed to load changelog."))
  }, [open, content])

  const header = (
    <div className="flex items-center gap-3">
      <span className="font-mono text-sm text-primary">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      <a
        href="https://github.com/jordanlambrecht/tracker-tracker/releases"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-tertiary hover:text-accent transition-colors duration-150"
      >
        View on GitHub
      </a>
    </div>
  )

  return (
    <Dialog open={open} onClose={onClose} title={header} size="sm" maxHeight="70vh">
      <div className="prose prose-invert prose-sm max-w-none prose-headings:font-mono prose-h1:hidden prose-h2:text-sm prose-h2:font-medium prose-h2:text-primary prose-h2:border-t prose-h2:border-border prose-h2:pt-4 prose-h2:mt-4 prose-h2:mb-2 prose-h2:first:border-0 prose-h2:first:pt-0 prose-h2:first:mt-0 prose-h3:text-xs prose-h3:font-medium prose-h3:text-tertiary prose-h3:mb-1 prose-h3:mt-2.5 prose-li:text-secondary prose-li:text-[13px] prose-li:leading-relaxed prose-p:text-secondary prose-strong:text-primary prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-ul:my-1.5 prose-ul:pl-4">
        {content ? (
          <ChangelogContent content={content} />
        ) : (
          <div className="flex flex-col gap-2.5">
            <Shimmer size="bar" className="w-28 h-3" />
            <Shimmer size="bar" className="w-16 h-2" />
            <Shimmer size="bar" className="w-full" />
            <Shimmer size="bar" className="w-5/6" />
            <Shimmer size="bar" className="w-full" />
            <Shimmer size="bar" className="w-3/4" />
            <Shimmer size="bar" className="w-20 h-3 mt-3" />
            <Shimmer size="bar" className="w-16 h-2" />
            <Shimmer size="bar" className="w-full" />
            <Shimmer size="bar" className="w-4/5" />
          </div>
        )}
      </div>
    </Dialog>
  )
}
