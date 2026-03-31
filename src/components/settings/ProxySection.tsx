// src/components/settings/ProxySection.tsx
"use client"

import { H3, Paragraph, Subtext } from "@typography"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Badge, Button, Input, NumberInput, SaveDiscardBar, Select, Toggle } from "@/components/ui"
import { useActionStatus } from "@/hooks/useActionStatus"
import { usePatchSettings } from "@/hooks/usePatchSettings"
import { DOCS } from "@/lib/constants"
import { extractApiError } from "@/lib/helpers"

export interface ProxySectionProps {
  initialProxy: {
    enabled: boolean
    type: string
    host: string
    port: number
    username: string
    hasPassword: boolean
  }
  trackers: { id: number; name: string; color: string }[]
}

export function ProxySection({ initialProxy, trackers }: ProxySectionProps) {
  const [proxyEnabled, setProxyEnabled] = useState(initialProxy.enabled)
  const defaultPortForType = (type: string) =>
    type === "https" ? 443 : type === "http" ? 8080 : 1080

  const [proxyType, setProxyType] = useState(initialProxy.type || "socks5")
  const [proxyHost, setProxyHost] = useState(initialProxy.host)
  const [proxyPort, setProxyPort] = useState(initialProxy.port)
  const [proxyUsername, setProxyUsername] = useState(initialProxy.username)
  const [proxyPassword, setProxyPassword] = useState("")
  const [proxyPasswordPlaceholder, setProxyPasswordPlaceholder] = useState(initialProxy.hasPassword)
  const {
    status: proxyTestStatus,
    error: proxyTestError,
    execute: executeProxyTest,
  } = useActionStatus({ autoResetMs: false })
  const [proxyTestIp, setProxyTestIp] = useState<string | null>(null)
  const [savedProxy, setSavedProxy] = useState({
    enabled: initialProxy.enabled,
    type: initialProxy.type || "socks5",
    host: initialProxy.host,
    port: initialProxy.port,
    username: initialProxy.username,
    hasPassword: initialProxy.hasPassword,
  })

  const {
    saving: savingProxy,
    error: proxyError,
    success: proxySuccess,
    patch,
    clearSuccess: clearProxySuccess,
  } = usePatchSettings()

  const proxyHasChanges =
    proxyEnabled !== savedProxy.enabled ||
    proxyType !== savedProxy.type ||
    proxyHost !== savedProxy.host ||
    proxyPort !== savedProxy.port ||
    proxyUsername !== savedProxy.username ||
    (proxyPassword !== "" && proxyPassword !== undefined)

  async function handleSaveProxy() {
    const payload: Record<string, unknown> = {
      proxyEnabled,
      proxyType,
      proxyHost: proxyHost.trim() || null,
      proxyPort,
      proxyUsername: proxyUsername.trim() || null,
    }
    // Only send password if user typed a new one
    if (proxyPassword) {
      payload.proxyPassword = proxyPassword
    } else if (!proxyPasswordPlaceholder) {
      // User cleared the password
      payload.proxyPassword = null
    }

    const result = await patch(payload)
    if (!result) return

    const typed = result as {
      proxyEnabled: boolean
      proxyType: string
      proxyHost: string | null
      proxyPort: number | null
      proxyUsername: string | null
      hasProxyPassword: boolean
    }
    setSavedProxy({
      enabled: typed.proxyEnabled,
      type: typed.proxyType,
      host: typed.proxyHost ?? "",
      port: typed.proxyPort ?? 1080,
      username: typed.proxyUsername ?? "",
      hasPassword: typed.hasProxyPassword,
    })
    setProxyPasswordPlaceholder(typed.hasProxyPassword)
    setProxyPassword("")
  }

  function handleTestProxy() {
    setProxyTestIp(null)
    executeProxyTest(async () => {
      const res = await fetch("/api/settings/proxy-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxyType,
          proxyHost: proxyHost.trim(),
          proxyPort,
          proxyUsername: proxyUsername.trim() || undefined,
          proxyPassword: proxyPassword || undefined,
          useStoredPassword: proxyPasswordPlaceholder && !proxyPassword,
        }),
      })
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Connection failed"))
      }
      const data = (await res.json()) as { success: boolean; proxyIp?: string; error?: string }
      if (!data.success) {
        throw new Error(data.error ?? "Connection failed")
      }
      setProxyTestIp(data.proxyIp ?? null)
    })
  }

  return (
    <SettingsSection
      id="proxy"
      title="Proxy"
      tooltip="Route tracker requests through a proxy server."
      docs={DOCS.PROXIES}
      notice={{
        label: "EXPERIMENTAL",
        message: "Use at your own risk. May result in IP leaks and/or angry mods.",
      }}
      cardClassName="flex flex-col gap-5"
    >
      <Toggle
        label="Route tracker requests through a proxy"
        checked={proxyEnabled}
        onChange={(v) => {
          setProxyEnabled(v)
          clearProxySuccess()
        }}
        description="When enabled, all API polling requests to trackers are routed through the configured proxy server instead of your direct IP."
      />

      {proxyEnabled && (
        <>
          <div className="border-t border-border" />

          <div className="flex gap-4 items-end">
            <div className="w-36">
              <Select
                label="Type"
                value={proxyType}
                onChange={(newType) => {
                  const oldDefault = defaultPortForType(proxyType)
                  setProxyType(newType)
                  // Auto-fill port if user hasn't customized it from the current type's default
                  if (proxyPort === oldDefault) {
                    setProxyPort(defaultPortForType(newType))
                  }
                }}
                ariaLabel="Proxy type"
                size="md"
                options={[
                  { value: "socks5", label: "SOCKS5" },
                  { value: "http", label: "HTTP" },
                  { value: "https", label: "HTTPS" },
                ]}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Host"
                value={proxyHost}
                onChange={(e) => setProxyHost(e.target.value)}
                placeholder="127.0.0.1 or proxy.example.com"
              />
            </div>
            <NumberInput
              label="Port"
              value={proxyPort}
              onChange={setProxyPort}
              min={1}
              max={65535}
            />
          </div>

          <div className="border-t border-border" />

          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                label="Username"
                value={proxyUsername}
                onChange={(e) => setProxyUsername(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex-1">
              <Input
                type="password"
                autoComplete="off"
                data-1p-ignore
                label="Password"
                value={proxyPassword}
                onChange={(e) => {
                  setProxyPassword(e.target.value)
                  clearProxySuccess()
                }}
                placeholder={proxyPasswordPlaceholder ? "••••••••" : "Optional"}
              />
            </div>
          </div>

          <Subtext>
            Credentials are only required if your proxy server uses authentication. They are
            encrypted at rest alongside your API tokens.
          </Subtext>

          <div className="border-t border-border" />

          <SaveDiscardBar
            dirty={proxyHasChanges}
            saving={savingProxy}
            onSave={handleSaveProxy}
            saveDisabled={!proxyHost.trim()}
            error={proxyError}
            success={proxySuccess ? "Proxy settings saved." : null}
            saveLabel="Save Proxy"
            justify="end"
            showDivider={false}
          />

          <div className="border-t border-border" />

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              disabled={!proxyHost.trim() || proxyTestStatus === "pending"}
              onClick={handleTestProxy}
            >
              {proxyTestStatus === "pending"
                ? "Testing..."
                : proxyTestStatus === "success"
                  ? "Connected"
                  : proxyTestStatus === "failed"
                    ? "Failed — Retry"
                    : "Test Connection"}
            </Button>
            {proxyTestStatus === "success" && (
              <Badge variant="success">
                Proxy reachable{proxyTestIp ? ` (${proxyTestIp})` : ""}
              </Badge>
            )}
            {proxyTestStatus === "failed" && (
              <Badge variant="danger">{proxyTestError ?? "Unreachable"}</Badge>
            )}
          </div>
        </>
      )}

      <div className="border-t border-border" />

      {/* Linked Trackers */}
      <div className="flex flex-col gap-3">
        <H3>Linked Trackers</H3>
        {trackers.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {trackers.map((t) => (
              <Badge key={t.id} variant="default">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}
              </Badge>
            ))}
          </div>
        ) : (
          <Paragraph>
            No trackers are using the proxy. Enable it per-tracker in each tracker&apos;s settings
            dialog.
          </Paragraph>
        )}
        <Subtext>
          Toggle proxy usage for individual trackers via their settings dialog on the tracker detail
          page.
        </Subtext>
      </div>
    </SettingsSection>
  )
}
