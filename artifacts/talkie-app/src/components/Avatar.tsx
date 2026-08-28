interface AvatarProps {
  name: string
  color: string
  size?: number
  ring?: boolean
  avatarUrl?: string
}

// Avatar affiche la photo si avatarUrl est fournie, sinon des initiales generees a partir du nom.
export default function Avatar({ name, color, size = 44, ring = false, avatarUrl }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const ringClass = ring ? 'ring-2 ring-offset-2 ring-offset-ink' : ''

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${ringClass}`}
        style={{
          width: size,
          height: size,
          ...(ring ? ({ ['--tw-ring-color' as any]: color } as React.CSSProperties) : {}),
        }}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-display font-semibold text-ink shrink-0 ${ringClass}`}
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
