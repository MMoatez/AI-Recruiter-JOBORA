export function getContrastTextColor(color: string): "#000000" | "#ffffff" {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  if (!match) return "#000000"

  const hex = match[1].length === 3
    ? [...match[1]].map((digit) => `${digit}${digit}`).join("")
    : match[1]
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const contrastWithBlack = (luminance + 0.05) / 0.05
  const contrastWithWhite = 1.05 / (luminance + 0.05)

  return contrastWithWhite > contrastWithBlack ? "#ffffff" : "#000000"
}
