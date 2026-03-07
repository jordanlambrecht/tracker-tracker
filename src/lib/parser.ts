// src/lib/parser.ts
//
// Functions: parseBytes, formatBytes

const BINARY_UNITS: Record<string, bigint> = {
  B: BigInt(1),
  KiB: BigInt(1024),
  MiB: BigInt(1024 ** 2),
  GiB: BigInt(1024 ** 3),
  TiB: BigInt(2) ** BigInt(40),
}

const DECIMAL_UNITS: Record<string, bigint> = {
  KB: BigInt(1000),
  MB: BigInt(1000 ** 2),
  GB: BigInt(1000 ** 3),
  TB: BigInt(1000 ** 4),
}

/**
 * Multiplies a decimal string value by a bigint multiplier using exact bigint
 * arithmetic to avoid floating-point precision loss. The value is decomposed
 * into its integer and fractional parts, each multiplied by the multiplier,
 * and then combined.
 */
function multiplyDecimalStringByBigInt(
  valueStr: string,
  multiplier: bigint,
): bigint {
  const dotIndex = valueStr.indexOf(".")
  if (dotIndex === -1) {
    return BigInt(valueStr) * multiplier
  }

  const intPart = valueStr.slice(0, dotIndex)
  const fracPart = valueStr.slice(dotIndex + 1)
  const fracLen = fracPart.length

  // Scale factor: 10^fracLen
  const scale = BigInt(10) ** BigInt(fracLen)

  // Combine into a single scaled integer: intPart * scale + fracPart
  const scaledValue = BigInt(intPart) * scale + BigInt(fracPart)

  // Multiply by the unit multiplier, then divide by scale (rounding)
  const raw = scaledValue * multiplier
  const quotient = raw / scale
  const remainder = raw % scale

  // Round half-up
  if (remainder * BigInt(2) >= scale) {
    return quotient + BigInt(1)
  }
  return quotient
}

export function parseBytes(formatted: string): bigint {
  const trimmed = formatted.trim()
  const match = trimmed.match(/^([\d.]+)\s*([A-Za-z]+)$/)
  if (!match) {
    throw new Error(`Invalid byte format: "${formatted}"`)
  }

  const valueStr = match[1]
  const unit = match[2]

  // Reject negative values (the regex already excludes the minus sign, but be
  // explicit in case the input bypasses the regex somehow)
  if (valueStr.startsWith("-")) {
    throw new Error(`Negative byte values are not allowed: "${formatted}"`)
  }

  const binaryMultiplier = BINARY_UNITS[unit]
  if (binaryMultiplier !== undefined) {
    return multiplyDecimalStringByBigInt(valueStr, binaryMultiplier)
  }

  const decimalMultiplier = DECIMAL_UNITS[unit]
  if (decimalMultiplier !== undefined) {
    return multiplyDecimalStringByBigInt(valueStr, decimalMultiplier)
  }

  throw new Error(`Unknown unit: "${unit}"`)
}

const FORMAT_THRESHOLDS: Array<{
  unit: string
  threshold: bigint
  divisor: number
}> = [
  {
    unit: "TiB",
    threshold: BigInt(2) ** BigInt(40),
    divisor: Number(BigInt(2) ** BigInt(40)),
  },
  { unit: "GiB", threshold: BigInt(1024 ** 3), divisor: 1024 ** 3 },
  { unit: "MiB", threshold: BigInt(1024 ** 2), divisor: 1024 ** 2 },
  { unit: "KiB", threshold: BigInt(1024), divisor: 1024 },
]

export function formatBytes(bytes: bigint): string {
  if (bytes === BigInt(0)) return "0 B"

  for (const { unit, threshold, divisor } of FORMAT_THRESHOLDS) {
    if (bytes >= threshold) {
      const value = Number(bytes) / divisor
      return `${value.toFixed(2)} ${unit}`
    }
  }

  return `${bytes} B`
}
