// src/lib/image-hosting/index.ts
//
// Functions: getImageHostAdapter

import { imgbbAdapter } from "@/lib/image-hosting/imgbb"
import { onlyimageAdapter } from "@/lib/image-hosting/onlyimage"
import { ptpimgAdapter } from "@/lib/image-hosting/ptpimg"
import type { ImageHostAdapter, ImageHostId } from "@/lib/image-hosting/types"

const adapters: Record<ImageHostId, ImageHostAdapter> = {
  ptpimg: ptpimgAdapter,
  onlyimage: onlyimageAdapter,
  imgbb: imgbbAdapter,
}

export function getImageHostAdapter(host: ImageHostId): ImageHostAdapter {
  const adapter = adapters[host]
  if (!adapter) throw new Error(`Unknown image host: ${host}`)
  return adapter
}

export type { ImageHostId, UploadOptions, UploadResult } from "./types"
