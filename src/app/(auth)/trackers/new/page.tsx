// src/app/(auth)/trackers/new/page.tsx
"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { Button, Card, Input } from "@/components/ui"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"

export default function AddTrackerPage() {
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [pollInterval, setPollInterval] = useState("360")
  const [color, setColor] = useState("#00d4ff")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function selectPreset(slug: string) {
    const entry = TRACKER_REGISTRY.find((t) => t.slug === slug)
    if (entry) {
      setName(entry.name)
      setBaseUrl(entry.url)
      setColor(entry.color)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")

    if (!name || !baseUrl || !apiToken) {
      setError("All fields are required")
      return
    }

    setLoading(true)

    const res = await fetch("/api/trackers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        baseUrl,
        apiToken,
        pollIntervalMinutes: parseInt(pollInterval, 10),
        color,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/trackers/${data.id}`)
    } else {
      const data = await res.json()
      setError(data.error || "Failed to add tracker")
    }

    setLoading(false)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-primary mb-4">Add Tracker</h2>

      <div className="flex flex-wrap gap-2 mb-6">
        {TRACKER_REGISTRY.map((preset) => (
          <button
            key={preset.slug}
            type="button"
            onClick={() => selectPreset(preset.slug)}
            className={`
              px-3 py-1.5 rounded text-xs border transition-all
              ${
                name === preset.name
                  ? "border-accent/40 bg-accent-dim text-accent"
                  : "border-border text-tertiary hover:text-secondary hover:border-border-emphasis"
              }
            `}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Tracker Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Aither"
          />
          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://aither.cc"
          />
          <Input
            label="API Token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Your UNIT3D API token"
          />
          <div>
            <label
              htmlFor="poll-interval"
              className="text-xs font-medium text-secondary mb-1 block"
            >
              Poll Interval
            </label>
            <select
              id="poll-interval"
              value={pollInterval}
              onChange={(e) => setPollInterval(e.target.value)}
              className="w-full rounded bg-control-bg border border-control-border
                px-3 py-2 text-sm text-primary font-mono
                focus:outline-none focus:border-control-focus focus:ring-1 focus:ring-control-focus"
            >
              <option value="60">Every hour</option>
              <option value="180">Every 3 hours</option>
              <option value="360">Every 6 hours</option>
              <option value="720">Every 12 hours</option>
              <option value="1440">Every 24 hours</option>
            </select>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Tracker"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
