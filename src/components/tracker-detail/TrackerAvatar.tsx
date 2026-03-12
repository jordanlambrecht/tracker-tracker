// src/components/tracker-detail/TrackerAvatar.tsx

"use client"

import Image from "next/image"
import { useState } from "react"
import { UserIcon } from "@/components/ui/Icons"

interface TrackerAvatarProps {
  trackerId: number
  accentColor: string
}

export function TrackerAvatar({ trackerId, accentColor }: TrackerAvatarProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <UserIcon width="24" height="24" stroke={accentColor} />
  }

  return (
    <Image
      src={`/api/trackers/${trackerId}/avatar`}
      alt="User avatar"
      width={56}
      height={56}
      className="w-full h-full object-cover rounded-nm-pill"
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}
