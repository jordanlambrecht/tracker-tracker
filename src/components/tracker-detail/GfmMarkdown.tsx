// src/components/tracker-detail/GfmMarkdown.tsx
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Reached only through next/dynamic in TrackerInfoTab, so react-markdown and
// remark-gfm load with the Full Rules section instead of with the page.
export function GfmMarkdown(props: { children: string; className?: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} {...props} />
}
