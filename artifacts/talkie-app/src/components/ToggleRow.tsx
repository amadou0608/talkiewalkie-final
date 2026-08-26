interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}

export default function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span>
        <span className="block text-sm text-paper">{label}</span>
        {description && <span className="block text-xs text-paperDim">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-transmit' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
