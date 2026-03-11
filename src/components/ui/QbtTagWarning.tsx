// src/components/ui/QbtTagWarning.tsx

const QBT_TAG_WARN_PATTERN = /[+&#%?]/

function QbtTagWarning({ tag }: { tag: string }) {
  if (!QBT_TAG_WARN_PATTERN.test(tag)) return null

  return (
    <p className="text-xs font-sans text-warning">
      Tags with +, &amp;, #, %, or ? may not filter correctly in some qBittorrent versions.
    </p>
  )
}

export { QbtTagWarning, QBT_TAG_WARN_PATTERN }
