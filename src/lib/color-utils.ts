// src/lib/color-utils.ts
//
// Shared color conversion utilities. Pure math only — no browser or Node.js APIs.
//
// Functions: hslToRgb, rgbToHsl, hslToRgbBuffer, hexToRgbTuple, byteToColor, colorToByte

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
