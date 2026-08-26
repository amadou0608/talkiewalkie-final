interface AvatarProps {
  name: string
  color: string
  size?: number
  ring?: boolean
}

// Avatar genere a partir des initiales — aucune photo requise en phase 1.
export default function Avatar({ name, color, size = 44, ring = false }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div
      className={`flex items-center justify-center rounded-full font-display font-semibold text-ink shrink-0 ${
        ring ? 'ring-2 ring-offset-2 ring-offset-ink' : ''
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.38,
        ...(ring ? ({ ['--tw-ring-color' as any]: color } as React.CSSProperties) : {}),
      }}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  )
}
