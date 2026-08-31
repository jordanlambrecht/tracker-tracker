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

/**
 * Shown when a tracker has no qBittorrent tag and nothing matched by announce URL.
 *
 * Tags are no longer a prerequisite. Torrents are attributed by announce host
 * when untagged (issue #152). This state means "nothing found", not "not set up".
 * Tagging is offered as an optional lever, not a requirement.
 */
export function NoTagState({ trackerName }: { trackerName: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 nm-inset-sm bg-control-bg rounded-nm-lg">
      <TagIcon width={40} height={40} className="text-muted" />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-sans text-secondary">No torrents matched {trackerName}</p>
        <p className="text-xs font-sans text-muted max-w-sm">
          Torrents are matched by announce URL, so no tag is needed, but nothing in your client
          announces to {trackerName}. Set a qBittorrent tag in tracker settings to match by tag
          instead.
        </p>
      </div>
    </div>
  )
}

/**
 * Shown when a tracker has a qBittorrent tag but still resolved nothing by that
 * tag or announce URL. Distinct from NoTagState so a wrong tag reads as a wrong
 * tag rather than as an empty tracker.
 */
export function NoTorrentsState({ trackerName, qbtTag }: { trackerName: string; qbtTag: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 nm-inset-sm bg-control-bg rounded-nm-lg">
      <TagIcon width={40} height={40} className="text-muted" />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-sans text-secondary">No torrents found for {trackerName}</p>
        <p className="text-xs font-sans text-muted max-w-sm">
          Nothing in your client carries the tag{" "}
          <span className="font-mono text-secondary">{qbtTag}</span> or announces to {trackerName}.
          Check the tag in tracker settings if you expected torrents here.
        </p>
      </div>
    </div>
  )
}
