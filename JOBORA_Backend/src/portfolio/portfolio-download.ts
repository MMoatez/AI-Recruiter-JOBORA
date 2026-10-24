import { basename } from "node:path"

export function portfolioCvDisposition(filename: string): string {
  const safeFilename = basename(filename.replace(/\\/g, "/")).replace(/[\r\n"]/g, "_") || "cv.pdf"
  const encodedFilename = encodeURIComponent(safeFilename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  const fallbackFilename = safeFilename.replace(/[^\x20-\x7e]/g, "_")
  return `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`
}
