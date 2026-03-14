// src/components/ui/StatCard.tsx
//
// Functions: StatCard
//
// Unified stat card with three variants:
//   "basic"   — single hero value (default)
//   "stacked" — multiple label/value rows with optional total
//   "ring"    — countdown ring (login deadline)

"use client"

import clsx from "clsx"
import { type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react"
import { CHART_THEME } from "@/components/charts/theme"
import { hexToRgba } from "@/lib/formatters"

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type TrendDirection = "up" | "down" | "flat"

interface StatCardRow {
  label: string
  prefix?: string
  value: string | number
  unit?: string
  colorClass?: string
}

interface StatCardTotal {
  label: string
  value: string
}

// ---------------------------------------------------------------------------
// Variant prop types
// ---------------------------------------------------------------------------

type AlertLevel = "warn" | "danger"

interface StatCardBase extends HTMLAttributes<HTMLDivElement> {
  accentColor?: string
  icon?: ReactNode
  alert?: AlertLevel
  alertReason?: string
}

interface StatCardBasicProps extends StatCardBase {
  type?: "basic"
  label: string
  value: string | number
  subValue?: string
  unit?: string
  subtitle?: string
  trend?: TrendDirection
  tooltip?: string
}

interface StatCardStackedProps extends StatCardBase {
  type: "stacked"
  title: string
  rows: StatCardRow[]
  total?: StatCardTotal
  tooltip?: string
}

interface StatCardRingProps extends StatCardBase {
  type: "ring"
  title?: string
  lastAccessAt: string
  loginIntervalDays: number
  tooltip?: string
}

type StatCardProps = StatCardBasicProps | StatCardStackedProps | StatCardRingProps

// ---------------------------------------------------------------------------
// Shell — shared card wrapper
// ---------------------------------------------------------------------------

function Shell({
  accentColor,
  accentOverride,
  alert,
  children,
  className,
  style,
  center,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  accentColor?: string
  accentOverride?: string
  alert?: AlertLevel
  center?: boolean
}) {
  const alertColor = alert === "danger" ? CHART_THEME.danger : alert === "warn" ? CHART_THEME.warn : null
  const glowColor = alertColor ?? accentOverride ?? accentColor
  return (
    <div
      className={clsx(
        "bg-raised p-5 flex flex-col gap-2 nm-raised rounded-nm-lg overflow-visible relative",
        center && "items-center gap-3",
        className,
      )}
      style={{
        filter: glowColor ? `drop-shadow(0 -2px 12px ${hexToRgba(glowColor, alertColor ? 0.25 : 0.1)})` : undefined,
        outline: alertColor ? `1px solid ${hexToRgba(alertColor, 0.25)}` : undefined,
        outlineOffset: "-1px",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header — title + optional icon + optional tooltip
// ---------------------------------------------------------------------------

function Header({
  label,
  icon,
  tooltip,
  alert,
  alertReason,
}: { label: string; icon?: ReactNode; tooltip?: string; alert?: AlertLevel; alertReason?: string }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showAlertTip, setShowAlertTip] = useState(false)
  const tipTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const alertTipTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  function enterTip() { if (tipTimeout.current) clearTimeout(tipTimeout.current); setShowTooltip(true) }
  function leaveTip() { tipTimeout.current = setTimeout(() => setShowTooltip(false), 150) }
  function enterAlert() { if (alertTipTimeout.current) clearTimeout(alertTipTimeout.current); setShowAlertTip(true) }
  function leaveAlert() { alertTipTimeout.current = setTimeout(() => setShowAlertTip(false), 150) }
  useEffect(() => () => {
    if (tipTimeout.current) clearTimeout(tipTimeout.current)
    if (alertTipTimeout.current) clearTimeout(alertTipTimeout.current)
  }, [])

  const alertColor = alert === "danger" ? CHART_THEME.danger : alert === "warn" ? CHART_THEME.warn : null

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 relative">
        <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
          {label}
        </p>
        {tooltip && (
          <button
            type="button"
            className="cursor-help text-[9px] font-bold text-muted opacity-50 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current hover:opacity-80 focus:opacity-80 transition-opacity outline-none"
            onMouseEnter={enterTip}
            onMouseLeave={leaveTip}
            onFocus={enterTip}
            onBlur={leaveTip}
            aria-label={`Info: ${label}`}
          >
            ?
            {showTooltip && (
              <span role="tooltip" className="absolute left-0 top-full mt-1.5 z-50 w-52 px-3 py-2 text-[11px] font-sans font-normal normal-case tracking-normal text-secondary rounded-nm-sm leading-relaxed whitespace-normal" style={{ backgroundColor: "#343648", boxShadow: "4px 4px 8px #1b1c24, -4px -4px 8px #353848" }}>
                {tooltip}
              </span>
            )}
          </button>
        )}
        {alertReason && alertColor && (
          <button
            type="button"
            className="cursor-help text-[9px] font-bold inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current hover:opacity-80 transition-opacity outline-none"
            style={{ color: alertColor }}
            onMouseEnter={enterAlert}
            onMouseLeave={leaveAlert}
            onFocus={enterAlert}
            onBlur={leaveAlert}
            aria-label={`Alert: ${alertReason}`}
          >
            !
            {showAlertTip && (
              <span role="tooltip" className="absolute left-0 top-full mt-1.5 z-50 w-52 px-3 py-2 text-[11px] font-sans font-normal normal-case tracking-normal text-secondary rounded-nm-sm leading-relaxed whitespace-normal" style={{ backgroundColor: "#343648", boxShadow: "4px 4px 8px #1b1c24, -4px -4px 8px #353848" }}>
                {alertReason}
              </span>
            )}
          </button>
        )}
      </div>
      {icon && (
        <span className="text-tertiary shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Basic variant — single hero value
// ---------------------------------------------------------------------------

const trendConfig: Record<TrendDirection, { symbol: string; colorClass: string; label: string }> = {
  up: { symbol: "▲", colorClass: "text-success", label: "Trending up" },
  down: { symbol: "▼", colorClass: "text-danger", label: "Trending down" },
  flat: { symbol: "—", colorClass: "text-secondary", label: "No change" },
}

function BasicContent({ value, unit, trend, subtitle, subValue }: {
  value: string | number; unit?: string; trend?: TrendDirection; subtitle?: string; subValue?: string
}) {
  const trendInfo = trend ? trendConfig[trend] : null
  return (
    <>
      <div className="flex items-end gap-2">
        <span className="font-mono text-2xl font-semibold text-primary leading-none">{value}</span>
        {unit && <span className="font-mono text-xs font-normal text-muted leading-none mb-0.5">{unit}</span>}
        {trendInfo && (
          <span className={clsx("font-mono text-sm leading-none mb-1", trendInfo.colorClass)} title={trendInfo.label}>
            <span className="sr-only">{trendInfo.label}</span>
            <span aria-hidden="true">{trendInfo.symbol}</span>
          </span>
        )}
      </div>
      {subtitle && <p className="font-mono text-xs text-muted">{subtitle}</p>}
      {subValue && <p className="font-mono text-xs text-tertiary">{subValue}</p>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Stacked variant — multiple label/value rows
// ---------------------------------------------------------------------------

function StackedContent({ rows, total }: { rows: StatCardRow[]; total?: StatCardTotal }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => {
          const isEmpty = row.value === "—" || row.value === 0 || row.value === ""
          const color = row.colorClass ?? (isEmpty ? "text-muted" : "text-primary")
          const display = row.prefix ? `${row.prefix}${row.value}` : row.value
          const withUnit = row.unit ? `${display} ${row.unit}` : display
          return (
            <div key={row.label}>
              {i > 0 && <div className="h-px bg-border opacity-50 mb-2" />}
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-mono text-muted">{row.label}</span>
                <span className={clsx("font-mono text-lg font-semibold leading-none tabular-nums", color)}>
                  {withUnit}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {total && (
        <>
          <div className="h-px bg-border opacity-50" />
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-mono text-tertiary">{total.label}</span>
            <span className="font-mono text-xl font-semibold leading-none text-primary tabular-nums">{total.value}</span>
          </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Ring variant — countdown progress
// ---------------------------------------------------------------------------

function getDeadlineColor(progress: number, accent: string): string {
  if (progress > 0.8) return CHART_THEME.danger
  if (progress > 0.5) return CHART_THEME.warn
  return accent
}

function RingContent({ lastAccessAt, loginIntervalDays, accentColor }: {
  lastAccessAt: string; loginIntervalDays: number; accentColor: string
}) {
  const now = Date.now()
  const lastAccess = new Date(lastAccessAt).getTime()
  if (Number.isNaN(lastAccess)) return null

  const totalMs = loginIntervalDays * 24 * 60 * 60 * 1000
  const elapsedMs = now - lastAccess
  const remainingMs = totalMs - elapsedMs
  const progress = Math.min(Math.max(elapsedMs / totalMs, 0), 1)
  const color = getDeadlineColor(progress, accentColor)
  const isOverdue = remainingMs <= 0
  const overdueDays = isOverdue ? Math.ceil(Math.abs(remainingMs) / (1000 * 60 * 60 * 24)) : 0

  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * progress

  const deadlineDate = new Date(lastAccess + totalMs)
  const deadlineDateStr = deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor(remainingMs / (1000 * 60 * 60))
  const valueText = remainingMs <= 0 ? "OVERDUE" : days >= 1 ? `${days}` : `${Math.max(1, hours)}`
  const unitText = remainingMs <= 0 ? "" : days >= 1 ? "days" : "hrs"

  return (
    <>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease", filter: `drop-shadow(0 0 4px ${hexToRgba(color, 0.5)})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-bold leading-none" style={{ color }}>{valueText}</span>
          {!isOverdue && <span className="font-mono text-[10px] text-muted mt-0.5">{unitText}</span>}
        </div>
      </div>
      <p className="font-mono text-[10px] text-muted text-center">
        {isOverdue ? `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue` : `by ${deadlineDateStr}`}
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------
// Unified StatCard
// ---------------------------------------------------------------------------

function StatCard(props: StatCardProps) {
  const { accentColor, icon, alert, alertReason, className, style, ...rest } = props

  if (props.type === "ring") {
    const la = new Date(props.lastAccessAt).getTime()
    if (Number.isNaN(la)) return null
    const progress = (() => {
      const total = props.loginIntervalDays * 86400000
      return Math.min(Math.max((Date.now() - la) / total, 0), 1)
    })()
    const ringColor = getDeadlineColor(progress, accentColor ?? CHART_THEME.accent)
    return (
      <Shell accentColor={accentColor} accentOverride={ringColor} alert={alert} className={className} style={style} center>
        <Header label={props.title ?? "Login Deadline"} icon={icon} tooltip={props.tooltip} alert={alert} alertReason={alertReason} />
        <RingContent lastAccessAt={props.lastAccessAt} loginIntervalDays={props.loginIntervalDays} accentColor={accentColor ?? CHART_THEME.accent} />
      </Shell>
    )
  }

  if (props.type === "stacked") {
    return (
      <Shell accentColor={accentColor} alert={alert} className={className} style={style}>
        <Header label={props.title} icon={icon} tooltip={props.tooltip} alert={alert} alertReason={alertReason} />
        <StackedContent rows={props.rows} total={props.total} />
      </Shell>
    )
  }

  // Default: basic
  return (
    <Shell accentColor={accentColor} alert={alert} className={clsx(className, props.tooltip && "overflow-visible")} style={style} {...rest}>
      <Header label={props.label} icon={icon} tooltip={props.tooltip} alert={alert} alertReason={alertReason} />
      <BasicContent value={props.value} unit={props.unit} trend={props.trend} subtitle={props.subtitle} subValue={props.subValue} />
    </Shell>
  )
}

export { StatCard }
export type { AlertLevel, StatCardProps, StatCardBasicProps, StatCardStackedProps, StatCardRingProps, StatCardRow, StatCardTotal, TrendDirection }
