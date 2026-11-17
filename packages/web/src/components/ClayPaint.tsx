import { useId } from 'react'

// Each plant owns its paints: gardens, thumbnails and exports can share one document safely.
export function useClayPaint() {
  const id = `clay${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return { id, paint: (part: string) => `url(#${id}-${part})` }
}

function tint(color: string, amount: number) {
  const value = Number.parseInt(color.slice(1), 16)
  const channels = [16, 8, 0].map((shift) => {
    const channel = (value >> shift) & 255
    return Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount))
      .toString(16)
      .padStart(2, '0')
  })
  return `#${channels.join('')}`
}

export default function ClayPaint({ id, colors }: { id: string; colors: Record<string, string> }) {
  return (
    <defs>
      {Object.entries(colors).map(([name, color]) => (
        <radialGradient key={name} id={`${id}-${name}`} cx="32%" cy="24%" r="82%">
          <stop offset="0" stopColor={tint(color, 0.38)} />
          <stop offset=".43" stopColor={color} />
          <stop offset=".83" stopColor={tint(color, -0.14)} />
          <stop offset="1" stopColor={tint(color, -0.3)} />
        </radialGradient>
      ))}
      <filter id={`${id}-shadow`} x="-25%" y="-25%" width="150%" height="155%">
        <feDropShadow dx="0" dy="1.2" stdDeviation=".8" floodColor="#443b46" floodOpacity=".17" />
      </filter>
    </defs>
  )
}
