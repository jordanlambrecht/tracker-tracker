// src/lib/color-utils.ts
//
// Shared color conversion utilities. Only does maths. Do not use browser/Node APIs here please.
//
// Functions: hslToRgb, rgbToHsl, hslToRgbBuffer, hexToRgbTuple, byteToColor, colorToByte,
//            hexToRgba, hexToInt, hexToHsl, hslToHex, generatePalette, getComplementaryColor

import { isValidHex } from "@/lib/validators"

/**
 * Convert HSL to an RGB tuple.
 * h: 0-360, s: 0-1, l: 0-1
 * Returns [r, g, b] each in 0-255.
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/**
 * Convert RGB to an HSL tuple.
 * r, g, b: 0-255
 * Returns [h, s, l] where h is 0-360, s and l are 0-1.
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

/**
 * Write an HSL color directly into a Uint8ClampedArray at the given pixel index.
 * Used for per-pixel writes in fractal renderers (avoids allocating a tuple per pixel).
 * h: 0-360, s: 0-1, l: 0-1
 * Writes r, g, b, a (255) into data[idx..idx+3].
 */
export function hslToRgbBuffer(
  h: number,
  s: number,
  l: number,
  data: Uint8ClampedArray,
  idx: number
): void {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0,
    g = 0,
    b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  data[idx] = Math.round((r + m) * 255)
  data[idx + 1] = Math.round((g + m) * 255)
  data[idx + 2] = Math.round((b + m) * 255)
  data[idx + 3] = 255
}

/**
 * Parse a CSS hex color string into an RGB tuple.
 * Accepts "#rrggbb" or "rrggbb".
 * Returns [r, g, b] each in 0-255.
 */
export function hexToRgbTuple(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex.slice(1) : hex
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/**
 * Map a byte value (0-255) to an RGB color via the full HSL hue wheel.
 * Fixed saturation (0.85) and lightness (0.5) for maximum discriminating power.
 */
export function byteToColor(byte: number): [number, number, number] {
  const hue = (byte / 256) * 360
  return hslToRgb(hue, 0.85, 0.5)
}

/**
 * Recover a byte (0-255) from an RGB color by inverting the hue mapping.
 */
export function colorToByte(r: number, g: number, b: number): number {
  const [hue] = rgbToHsl(r, g, b)
  return Math.round((hue / 360) * 256) % 256
}

import { DEFAULT_TRACKER_COLOR } from "@/lib/constants"

export function hexToRgba(hex: string, alpha: number): string {
  const safe = isValidHex(hex) ? hex : DEFAULT_TRACKER_COLOR
  const r = parseInt(safe.slice(1, 3), 16)
  const g = parseInt(safe.slice(3, 5), 16)
  const b = parseInt(safe.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function hexToInt(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16)
}

/**
 * Converts a hex color (#rrggbb) to HSL components.
 * Returns [hue (0-360), saturation (0-1), lightness (0-1)].
 */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return [h * 360, s, l]
}

/**
 * Converts HSL components to a hex color string.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = (((h % 360) + 360) % 360) / 360

  function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, hNorm + 1 / 3)
    g = hue2rgb(p, q, hNorm)
    b = hue2rgb(p, q, hNorm - 1 / 3)
  }

  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Generates `count` visually distinct colors by rotating hue evenly across
 * 360°, anchored at the hue of `baseColor`. Saturation and lightness are
 * clamped to values that look good on dark backgrounds.
 */
export function generatePalette(count: number, baseColor: string): string[] {
  if (count === 0) return []
  const [baseH, baseS, baseL] = hexToHsl(baseColor)
  const sat = Math.max(baseS, 0.55)
  const lit = Math.min(Math.max(baseL, 0.45), 0.65)
  if (count === 1) return [hslToHex(baseH, sat, lit)]
  const step = 360 / count
  return Array.from({ length: count }, (_, i) => hslToHex(baseH + i * step, sat, lit))
}

/**
 * Generates a visually complementary color by rotating the hue.
 * Ensures visibility on dark backgrounds (min lightness 0.4, min saturation 0.5).
 */
export function getComplementaryColor(hex: string, rotation = 150): string {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h + rotation, Math.max(s, 0.5), Math.max(0.4, Math.min(0.7, l)))
}
