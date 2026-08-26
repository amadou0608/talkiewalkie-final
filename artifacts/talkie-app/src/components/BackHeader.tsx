import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function BackHeader({ title }: { title: string }) {
  const navigate = useNavigate()
  return (
    <header className="safe-top flex items-center gap-3 border-b border-line px-5 pt-4 pb-3">
      <button
        onClick={() => navigate(-1)}
        aria-label="Retour"
        className="rounded-full p-2 text-paperDim hover:text-paper hover:bg-panel2"
      >
        <ArrowLeft size={20} />
      </button>
      <h1 className="font-display text-xl font-semibold text-paper">{title}</h1>
    </header>
  )
}
