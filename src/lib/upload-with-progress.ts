// src/lib/upload-with-progress.ts
//
// Functions: postWithUploadProgress

/**
 * POSTs a body and reports how much of it has gone up, as a whole percent, then
 * 100 once it has all gone. fetch reports no upload progress, and a fetch request
 * stream needs HTTP/2 and isn't in Safari, so this goes through XMLHttpRequest.
 * It answers with a Response, so callers read it the way they read fetch's.
 */
export function postWithUploadProgress(
  url: string,
  body: XMLHttpRequestBodyInit,
  onProgress: (percent: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.floor((event.loaded / event.total) * 100))
    }
    xhr.upload.onload = () => onProgress(100)
    xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }))
    xhr.onerror = () => reject(new TypeError("Network error"))
    xhr.send(body)
  })
}
