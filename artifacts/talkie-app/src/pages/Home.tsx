import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessageCircle, UserPlus } from 'lucide-react'
import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import Avatar from '@/components/Avatar'
import StatusDot from '@/components/StatusDot'

import { useContacts } from '@/context/ContactsContext'
import { useAuth } from '@/context/AuthContext'
import { apiConversationSummaries, type ConversationSummary } from '@/lib/messagesApi'
import { connectSocket, getSocket } from '@/lib/socket'


// Accueil préparé pour Talkie Chat : les conversations complètes arrivent en
// Phase 14. Pour cette Phase 13, l'écran ne contient plus aucun contrôle PTT.
export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { accepted, loading } = useContacts()
  const [summaries, setSummaries] = useState<ConversationSummary[]>([])
  

  useEffect(() => {
    apiConversationSummaries().then(setSummaries).catch(() => {})
    connectSocket()
    const socket = getSocket()
    const refresh = () => apiConversationSummaries().then(setSummaries).catch(() => {})
    socket.on('message:new', refresh)
    socket.on('message:status', refresh)
    socket.on('message:updated', refresh)
    socket.on('message:deleted', refresh)
    return () => {
      socket.off('message:new', refresh)
      socket.off('message:status', refresh)
      socket.off('message:updated', refresh)
      socket.off('message:deleted', refresh)
    }
  }, [])

  const byUser = new Map(accepted.map((c) => [c.user.id, c]))
  const rows = summaries.length ? summaries : accepted.slice(0, 6).map((c) => ({
    userId: c.user.id, messageId: '', type: 'text' as const, content: null, createdAt: '', status: 'read' as const, senderId: user?.id ?? '', unreadCount: 0,
    user: { id: c.user.id, username: c.user.username, displayName: c.user.displayName, avatarColor: c.user.avatarColor, avatarUrl: c.user.avatarUrl },
  }))

  return (
    <div className="min-h-screen pb-24">
      <TopBar eyebrow={user ? `@${user.username}` : undefined} title="Talkie Chat" />
      <main className="mx-auto max-w-md px-5 pt-6">
        
        <div className="mb-5 flex items-center justify-between">
          <div><p className="callsign text-[11px] uppercase tracking-widest text-paperDim">Messagerie</p><h1 className="mt-1 font-display text-xl font-semibold text-paper">Conversations</h1></div>
          <button onClick={() => navigate('/contacts/add')} aria-label="Ajouter un contact" className="rounded-full border border-line bg-panel p-2.5 text-paperDim hover:bg-panel2 hover:text-paper"><UserPlus size={18} /></button>
        </div>
        {loading && rows.length === 0 && <p className="text-sm text-paperDim">Chargement de vos contacts...</p>}
        {!loading && rows.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center"><MessageCircle size={30} className="mx-auto text-paperDim" /><p className="mt-3 text-sm text-paperDim">Aucune conversation pour l'instant. Ajoutez un contact pour commencer.</p><button onClick={() => navigate('/contacts/add')} className="mt-4 rounded-xl bg-transmit px-4 py-2 font-display text-sm font-semibold text-ink">Ajouter un contact</button></div>}
        {rows.length > 0 && <div className="overflow-hidden rounded-2xl border border-line bg-panel">{rows.map((row) => {
          const contact = byUser.get(row.userId)
          const preview = row.type === 'text' ? (row.content || 'Message') : row.type === 'voice' ? '🎙️ Message vocal' : row.type === 'image' ? '📷 Photo' : '🎥 Vidéo'
          return <button key={row.userId} onClick={() => navigate(`/talk/${row.userId}`)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-b-0 hover:bg-panel2">
            <Avatar name={row.user.displayName} color={row.user.avatarColor} avatarUrl={row.user.avatarUrl} size={42} />
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-display text-sm font-semibold text-paper">{row.user.displayName}</p>{row.createdAt && <span className="shrink-0 text-[10px] text-paperDim">{new Date(row.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>}</div><div className="flex items-center gap-2"><p className={`truncate text-xs ${row.unreadCount ? 'font-semibold text-paper' : 'text-paperDim'}`}>{preview}</p>{row.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-transmit px-1.5 text-[10px] font-bold text-ink">{row.unreadCount > 99 ? '99+' : row.unreadCount}</span>}</div>{contact && <StatusDot status={contact.user.status} showLabel={false} />}</div>
            <ChevronRight size={17} className="shrink-0 text-paperDim" />
          </button>
        })}</div>}
      </main><BottomNav />
      
    </div>
  )
              }
