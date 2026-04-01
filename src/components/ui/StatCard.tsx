// src/components/ui/StatCard.tsx

//  three variants:
//   "basic"   — single hero value (default)
//   "stacked" — multiple label/value rows with optional total
//   "ring"    — countdown ring (login deadline)

import clsx from "clsx"
import type { HTMLAttributes, ReactNode } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { InfoTip, Tooltip } from "@/components/ui"
import { hexToRgba } from "@/lib/color-utils"

// ---------------------------------------------------------------------------
//  types
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
  unit?: string
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
  sumIsHero?: boolean
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
  const alertColor =
    alert === "danger" ? CHART_THEME.danger : alert === "warn" ? CHART_THEME.warn : null
  const glowColor = alertColor ?? accentOverride ?? accentColor
  return (
    <div
      className={clsx(
        "bg-raised p-5 flex flex-col gap-2 nm-raised-sm rounded-nm-lg overflow-visible relative",
        center && "items-center gap-3",
        className
      )}
      style={{
        filter: glowColor
          ? `drop-shadow(0 0 14px ${hexToRgba(glowColor, alertColor ? 0.18 : 0.09)})`
          : undefined,
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
}: {
  label: string
  icon?: ReactNode
  tooltip?: string
  alert?: AlertLevel
  alertReason?: string
}) {
  const alertColor =
    alert === "danger" ? CHART_THEME.danger : alert === "warn" ? CHART_THEME.warn : null

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
          {label}
        </p>
        {tooltip && (
          <InfoTip
            icon="question"
            size="sm"
            content={<span className="w-52 block">{tooltip}</span>}
          />
        )}
        {alertReason && alertColor && (
          <Tooltip content={<span className="w-52 block">{alertReason}</span>}>
            <button
              type="button"
              className="help-icon hover:opacity-80 transition-opacity outline-none"
              style={{ color: alertColor }}
              aria-label={`Alert: ${alertReason}`}
            >
              !
            </button>
          </Tooltip>
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

function BasicContent({
  value,
  unit,
  trend,
  subtitle,
  subValue,
}: {
  value: string | number
  unit?: string
  trend?: TrendDirection
  subtitle?: string
  subValue?: string
}) {
  const trendInfo = trend ? trendConfig[trend] : null
  return (
    <>
      <div className="flex items-end gap-2">
        <span className="font-mono text-2xl font-semibold text-primary leading-none">{value}</span>
        {unit && (
          <span className="font-mono text-xs font-normal text-muted leading-none mb-0.5">
            {unit}
          </span>
        )}
        {trendInfo && (
          <Tooltip content={trendInfo.label}>
            <span className={clsx("font-mono text-sm leading-none mb-1", trendInfo.colorClass)}>
              <span className="sr-only">{trendInfo.label}</span>
              <span aria-hidden="true">{trendInfo.symbol}</span>
            </span>
          </Tooltip>
        )}
      </div>
      {subtitle && <p className="font-mono text-xs text-muted">{subtitle}</p>}
      {subValue && <p className="font-mono text-xs text-tertiary">{subValue}</p>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Stacked variant
// ---------------------------------------------------------------------------

function StackedContent({
  rows,
  total,
  sumIsHero,
}: {
  rows: StatCardRow[]
  total?: StatCardTotal
  sumIsHero?: boolean
}) {
  return (
    <>
      {sumIsHero && total && (
        <div className="flex items-end gap-2">
          <span className="font-mono text-2xl font-semibold text-primary leading-none tabular-nums">
            {total.value}
          </span>
          {total.unit && (
            <span className="font-mono text-xs font-normal text-muted leading-none mb-0.5">
              {total.unit}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => {
          const isEmpty = row.value === "—" || row.value === 0 || row.value === ""
          const color = row.colorClass ?? (isEmpty ? "text-muted" : "text-primary")
          const display = row.prefix ? `${row.prefix}${row.value}` : row.value
          return (
            <div key={row.label}>
              {i > 0 && <div className="h-px bg-border opacity-50 mb-2" />}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-mono text-muted truncate shrink min-w-0">
                  {row.label}
                </span>
                <span
                  className={clsx(
                    "font-mono text-lg font-semibold leading-none tabular-nums whitespace-nowrap shrink-0",
                    color
                  )}
                >
                  {display}
                  {row.unit && (
                    <span className="text-xs font-normal text-muted ml-1">{row.unit}</span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {total && !sumIsHero && (
        <>
          <div className="h-px bg-border opacity-50" />
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-mono text-tertiary">{total.label}</span>
            <span className="font-mono text-xl font-semibold leading-none text-primary tabular-nums">
              {total.value}
            </span>
          </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Ring variant
// ---------------------------------------------------------------------------

function getDeadlineColor(progress: number, accent: string): string {
  if (progress > 0.8) return CHART_THEME.danger
  if (progress > 0.5) return CHART_THEME.warn
  return accent
}

function RingContent({
  lastAccessAt,
  loginIntervalDays,
  accentColor,
}: {
  lastAccessAt: string
  loginIntervalDays: number
  accentColor: string
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
  // Round to 2 decimal places to prevent SSR/client hydration mismatch
  const dashOffset = Math.round(circumference * progress * 100) / 100

  const deadlineDate = new Date(lastAccess + totalMs)
  const deadlineDateStr = deadlineDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor(remainingMs / (1000 * 60 * 60))
  const valueText = remainingMs <= 0 ? "OVERDUE" : days >= 1 ? `${days}` : `${Math.max(1, hours)}`
  const unitText = remainingMs <= 0 ? "" : days >= 1 ? "days" : "hrs"

  return (
    <>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease",
              filter: `drop-shadow(0 0 4px ${hexToRgba(color, 0.5)})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-bold leading-none" style={{ color }}>
            {valueText}
          </span>
          {!isOverdue && <span className="timestamp mt-0.5">{unitText}</span>}
        </div>
      </div>
      <p className="timestamp text-center">
        {isOverdue
          ? `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`
          : `by ${deadlineDateStr}`}
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------
// Unified StatCard
// ---------------------------------------------------------------------------

function StatCard(props: StatCardProps) {
  const {
    accentColor,
    icon,
    alert,
    alertReason,
    className,
    style,
    // Destructure component-only props so they don't leak into Shell's DOM spread
    ...rest
  } = props
  // Strip non-DOM props from rest before Shell spread
  const {
    label: _label,
    value: _value,
    unit: _unit,
    subValue: _subValue,
    subtitle: _subtitle,
    trend: _trend,
    ...shellRest
  } = rest as Record<string, unknown>

  if (props.type === "ring") {
    const la = new Date(props.lastAccessAt).getTime()
    if (Number.isNaN(la)) return null
    const progress = (() => {
      const total = props.loginIntervalDays * 86400000
      return Math.min(Math.max((Date.now() - la) / total, 0), 1)
    })()
    const ringColor = getDeadlineColor(progress, accentColor ?? CHART_THEME.accent)
    return (
      <Shell
        accentColor={accentColor}
        accentOverride={ringColor}
        alert={alert}
        className={className}
        style={style}
        center
      >
        <Header
          label={props.title ?? "Login Deadline"}
          icon={icon}
          tooltip={props.tooltip}
          alert={alert}
          alertReason={alertReason}
        />
        <RingContent
          lastAccessAt={props.lastAccessAt}
          loginIntervalDays={props.loginIntervalDays}
          accentColor={accentColor ?? CHART_THEME.accent}
        />
      </Shell>
    )
  }

  if (props.type === "stacked") {
    return (
      <Shell accentColor={accentColor} alert={alert} className={className} style={style}>
        <Header
          label={props.title}
          icon={icon}
          tooltip={props.tooltip}
          alert={alert}
          alertReason={alertReason}
        />
        <StackedContent rows={props.rows} total={props.total} sumIsHero={props.sumIsHero} />
      </Shell>
    )
  }

  // Default: basic
  return (
    <Shell
      accentColor={accentColor}
      alert={alert}
      className={className}
      style={style}
      {...shellRest}
    >
      <Header
        label={props.label}
        icon={icon}
        tooltip={props.tooltip}
        alert={alert}
        alertReason={alertReason}
      />
      <BasicContent
        value={props.value}
        unit={props.unit}
        trend={props.trend}
        subtitle={props.subtitle}
        subValue={props.subValue}
      />
    </Shell>
  )
}

export type {
  AlertLevel,
  StatCardBasicProps,
  StatCardProps,
  StatCardRingProps,
  StatCardRow,
  StatCardStackedProps,
  StatCardTotal,
  TrendDirection,
}
export { StatCard }
