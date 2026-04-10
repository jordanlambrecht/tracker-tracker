// src/components/dashboard/torrents/TorrentEmptyStates.tsx
"use client"

import Link from "next/link"
import { ServerIcon, TagIcon } from "@/components/ui/Icons"

export function NoDownloadClientState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 nm-inset-sm bg-control-bg rounded-nm-lg">
      <ServerIcon width={40} height={40} className="text-muted" />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-sans text-secondary">No download client connected</p>
        <p className="text-xs font-sans text-muted max-w-sm">
          Connect a qBittorrent client to see torrent data.{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Go to Settings
          </Link>
        </p>
      </div>
    </div>
  )
}

export function NoTagState({ trackerName }: { trackerName: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 nm-inset-sm bg-control-bg rounded-nm-lg">
      <TagIcon width={40} height={40} className="text-muted" />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-sans text-secondary">No qBittorrent tag set for {trackerName}</p>
        <p className="text-xs font-sans text-muted max-w-sm">
          Set a tag in tracker settings to filter torrents from your client.
        </p>
      </div>
    </div>
  )
}
