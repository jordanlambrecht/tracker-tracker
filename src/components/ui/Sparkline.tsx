// src/components/ui/Sparkline.tsx

interface SparklineProps {
  data: number[]
  color: string
  height?: number
  width?: number
}

function Sparkline({ data, color, height = 24, width = 80 }: SparklineProps) {
  if (data.length < 2) return null
  const max = data.reduce((m, v) => (v > m ? v : m), 1)
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 2) - 1}`)
  const fillPoints = `0,${height} ${points.join(" ")} ${width},${height}`

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden="true">
      <polygon points={fillPoints} fill={color} opacity={0.1} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export type { SparklineProps }
export { Sparkline }
