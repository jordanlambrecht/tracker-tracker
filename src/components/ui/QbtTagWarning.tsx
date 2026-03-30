// src/components/ui/QbtTagWarning.tsx

import { Notice } from "@/components/ui/Notice"

const QBT_TAG_WARN_PATTERN = /[+&#%?]/

function QbtTagWarning({ tag }: { tag: string }) {
  if (!QBT_TAG_WARN_PATTERN.test(tag)) return null

  return (
    <Notice
      variant="warn"
      message="Tags with +, &, #, %, or ? may not filter correctly in some qBittorrent versions."
    />
  )
}

export { QBT_TAG_WARN_PATTERN, QbtTagWarning }
