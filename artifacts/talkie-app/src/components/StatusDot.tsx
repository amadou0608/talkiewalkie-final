import type { PresenceStatus } from '@/types'

const COLORS: Record<PresenceStatus, string> = {
  online: 'bg-signal',
  away: 'bg-transmit',
  offline: 'bg-paperDim',
}

const LABELS: Record<PresenceStatus, string> = {
  online: 'En ligne',
  away: 'Absent',
  offline: 'Hors ligne',
}

export default function StatusDot({ status, showLabel = false }: { status: PresenceStatus; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${COLORS[status]}`} aria-hidden="true" />
      {showLabel && <span className="text-xs text-paperDim">{LABELS[status]}</span>}
    </span>
  )
}
