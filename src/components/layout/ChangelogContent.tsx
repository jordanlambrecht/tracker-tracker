// src/components/layout/ChangelogContent.tsx

"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ChangelogContentProps {
  content: string
}

export default function ChangelogContent({ content }: ChangelogContentProps) {
  return <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
}
