export function SoilDefs() {
  return (
    <>
      <linearGradient id="bnSoil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8b5e3c" />
        <stop offset="62%" stopColor="#7a5133" />
        <stop offset="100%" stopColor="#6d4729" />
      </linearGradient>
      <linearGradient id="bnSoilTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#b0805c" />
        <stop offset="100%" stopColor="#a0714f" />
      </linearGradient>
      {/* Co-prime tiles, or the specks settle into a visible lattice. */}
      <pattern id="bnGrainA" width="47" height="31" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="12" r="3" fill="#3a2212" opacity="0.13" />
      </pattern>
      <pattern id="bnGrainB" width="61" height="43" patternUnits="userSpaceOnUse">
        <circle cx="34" cy="27" r="2.4" fill="#3a2212" opacity="0.1" />
      </pattern>
      <pattern id="bnGrainC" width="37" height="53" patternUnits="userSpaceOnUse">
        <circle cx="21" cy="8" r="2.2" fill="#ffe2c4" opacity="0.15" />
      </pattern>
    </>
  )
}

/* Fixed control points, not random: the same garden has to export the same picture every time. */
export function soilPaths(x: number, w: number, surfaceY: number, bottomY: number) {
  const seg = w / 4
  const edge =
    `M ${x} ${surfaceY + 7} ` +
    `C ${x + seg * 0.6} ${surfaceY - 5}, ${x + seg * 1.4} ${surfaceY + 13}, ${x + seg * 2} ${surfaceY + 3} ` +
    `C ${x + seg * 2.6} ${surfaceY - 4}, ${x + seg * 3.4} ${surfaceY + 12}, ${x + w} ${surfaceY + 5}`
  return { edge, body: `${edge} L ${x + w} ${bottomY} L ${x} ${bottomY} Z` }
}

export function Soil({
  x,
  w,
  surfaceY,
  bottomY,
}: {
  x: number
  w: number
  surfaceY: number
  bottomY: number
}) {
  const { edge, body } = soilPaths(x, w, surfaceY, bottomY)
  return (
    <>
      <path d={body} fill="url(#bnSoil)" />
      <path d={body} fill="url(#bnGrainA)" />
      <path d={body} fill="url(#bnGrainB)" />
      <path d={body} fill="url(#bnGrainC)" />
      <path d={edge} fill="none" stroke="url(#bnSoilTop)" strokeWidth="17" />
    </>
  )
}

export const W = 1080
export const H = 1080
