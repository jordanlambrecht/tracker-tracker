// src/components/tracker-detail/TrackerCaptchaPrompt.tsx
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { CAPTCHA_PLATFORMS } from "@/data/platform-types"
import { extractApiError } from "@/lib/extract-api-error"
import { CAPTCHA_ANSWER_MAX } from "@/lib/limits"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

interface CaptchaState {
  pending: boolean
  image?: string | null
  expiresAt?: string
}

interface TrackerCaptchaPromptProps {
  tracker: TrackerSummary
  /** Called with the tracker as returned after the poll that follows the answer */
  onSolved: (tracker: TrackerSummary) => void
}

/**
 * The pending login captcha of a tracker. It is requested only while the
 * tracker's last error mentions a captcha.
 */
export function TrackerCaptchaPrompt({ tracker, onSolved }: TrackerCaptchaPromptProps) {
  const queryClient = useQueryClient()
  const [answer, setAnswer] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wanted =
    CAPTCHA_PLATFORMS.has(tracker.platformType) && /captcha/i.test(tracker.lastError ?? "")
  const queryKey = ["tracker-captcha", tracker.id]
  const { data } = useQuery({
    queryKey,
    enabled: wanted,
    queryFn: async ({ signal }): Promise<CaptchaState> => {
      const res = await fetch(`/api/trackers/${tracker.id}/captcha`, { signal })
      if (!res.ok) return { pending: false }
      return res.json()
    },
    refetchOnWindowFocus: false,
  })

  if (!wanted || !data?.pending) return null

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trackers/${tracker.id}/captcha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer.trim() }),
      })
      if (!res.ok) {
        setError(await extractApiError(res, "Captcha submission failed"))
        setAnswer("")
        // A wrong answer is followed by a new captcha.
        await queryClient.invalidateQueries({ queryKey })
        return
      }
      setAnswer("")
      const trackerRes = await fetch(`/api/trackers/${tracker.id}`)
      if (trackerRes.ok) onSolved(await trackerRes.json())
      queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
      await queryClient.invalidateQueries({ queryKey })
    } catch {
      setError("Network error. Please try again")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card elevation="elevated">
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (answer.trim() && !submitting) handleSubmit()
        }}
      >
        {data.image ? (
          <Image
            src={data.image}
            alt="Captcha"
            width={120}
            height={72}
            unoptimized
            className="rounded-nm-sm"
          />
        ) : (
          <Notice variant="warn" message="The captcha image could not be loaded" />
        )}
        <div className="w-48">
          <Input
            label="Captcha"
            name="tracker-captcha"
            autoComplete="off"
            data-1p-ignore
            value={answer}
            maxLength={CAPTCHA_ANSWER_MAX}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={submitting || !answer.trim()}
          text={submitting ? "Submitting..." : "Submit"}
        />
      </form>
      {error && <Notice message={error} />}
    </Card>
  )
}
