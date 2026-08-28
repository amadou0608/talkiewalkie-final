interface AvatarProps {
  name: string
  color: string
  avatarUrl?: string
  size?: number
  ring?: boolean
}

// Avatar genere a partir des initiales — sauf si avatarUrl est fourni
// (Phase 20 : photo de profil uploadee), auquel cas on affiche l'image.
export default function Avatar({ name, color, avatarUrl, size = 44, ring = false }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${ring ? 'ring-2 ring-offset-2 ring-offset-ink' : ''}`}
        style={{
          width: size,
          height: size,
          ...(ring ? ({ '--tw-ring-color': color } as any) : {}),
        }}
      />
    )
  }

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
        ...(ring ? ({ '--tw-ring-color': color } as any) : {}),
      }}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  )
}
