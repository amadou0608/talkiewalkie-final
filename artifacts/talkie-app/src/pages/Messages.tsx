// Messages vocaux hors ligne — Phase 8 (section 10 du cahier des charges).
// Remplace les donnees fictives de la Phase 1 par de vrais appels au
// backend (lib/voiceMessagesApi.ts). Meme pattern general que
// ContactsContext : chargement au montage, mise a jour temps reel via le
// WebSocket deja utilise pour la presence (Phase 5) et la signalisation
// Le même WebSocket partagé sera réutilisé par la messagerie complète.
//
// Theme 2 : mode incognito vocal (ecoute unique). Un vocal view_once ne peut
// pas etre lu via l'element <audio> partage (togglePlay) car le fichier est
// supprime du disque des que apiMarkVoiceMessageListened est appele — un
// <audio> qui streame encore a ce moment-la verrait sa lecture coupee. Ces
// vocaux passent donc par un flux separe (playViewOnceVoiceMessage) qui
// telecharge l'audio entier en memoire avant de le jouer.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Pause, Play } from 'lucide-react'
import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/context/AuthContext'
import { connectSocket, getSocket } from '@/lib/socket'
import {
  apiListVoiceMessages,
  apiMarkVoiceMessageListened,
  apiFetchVoiceMessageBlob,
  voiceMessageAudioUrl,
} from '@/lib/voiceMessagesApi'
import type { VoiceMessage } from '@/types'

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTimestamp(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Aujourd\u2019hui ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Hier ${time}`

  return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${time}`
}

export default function Messages() {
  const { status } = useAuth()
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  // Theme 2 : suit le vocal a ecoute unique en cours de telechargement/lecture,
  // separe de playingId (mecanisme different, voir plus haut).
  const [consumingId, setConsumingId] = useState<string | null>(null)

  const audioElRef = useRef<HTMLAudioElement | null>(null)
  if (!audioElRef.current && typeof window !== 'undefined') {
    const el = new Audio()
    // Indispensable : sans ca le navigateur n'envoie pas le cookie de
    // session sur cette requete cross-origin, et le serveur repond 401 (la
    // route /voice-messages/:id/audio n'est jamais servie en statique, voir
    // backend/src/modules/voice-messages/storage.ts).
    el.crossOrigin = 'use-credentials'
    audioElRef.current = el
  }

  const refresh = useCallback(async () => {
    setError(null)
    try {
      setMessages(await apiListVoiceMessages())
    } catch {
      setError('Impossible de charger vos messages vocaux.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      refresh()
    } else if (status === 'unauthenticated') {
      setMessages([])
      setLoading(false)
    }
  }, [status, refresh])

  // Rafraichissement temps reel : voir backend/src/modules/voice-messages/
  // voice-messages.controller.ts (evenement 'voice-message:new' emis a
  // l'envoi si le destinataire a un socket ouvert). Un simple refetch est
  // suffisant ici — la liste reste courte (limite 100 cote serveur).
  useEffect(() => {
    if (status !== 'authenticated') return
    connectSocket()
    const socket = getSocket()
    socket.on('voice-message:new', refresh)
    return () => {
      socket.off('voice-message:new', refresh)
    }
  }, [status, refresh])

  useEffect(() => {
    const el = audioElRef.current
    if (!el) return
    const onEnded = () => setPlayingId(null)
    el.addEventListener('ended', onEnded)
    return () => el.removeEventListener('ended', onEnded)
  }, [])

  // Coupe la lecture si l'utilisateur quitte la page en cours d'ecoute.
  useEffect(() => {
    return () => {
      audioElRef.current?.pause()
    }
  }, [])

  const togglePlay = (message: VoiceMessage) => {
    const el = audioElRef.current
    if (!el) return

    if (playingId === message.id) {
      el.pause()
      setPlayingId(null)
      return
    }

    el.src = voiceMessageAudioUrl(message.id)
    el.play().catch(() => setPlayingId(null))
    setPlayingId(message.id)

    if (!message.listenedAt) {
      // Optimiste : pas besoin d'attendre la reponse serveur pour retirer le
      // badge "non lu" a l'ecran. Idempotent cote serveur de toute facon.
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, listenedAt: new Date().toISOString() } : m)),
      )
      apiMarkVoiceMessageListened(message.id).catch(() => {
        // Sans consequence pour l'ecoute elle-meme ; le badge restera juste
        // "lu" localement meme si l'appel echoue, ce qui reste correct du
        // point de vue de l'utilisateur (il vient d'ecouter le message).
      })
    }
  }

  // Theme 2 : flux dedie pour un vocal a ecoute unique. Telecharge l'audio
  // entier en blob avant de le jouer (immunise contre la suppression du
  // fichier disque qui suit l'appel de consommation), puis marque le vocal
  // ecoute une fois la lecture demarree.
  async function playViewOnceVoiceMessage(message: VoiceMessage) {
    if (consumingId) return
    setConsumingId(message.id)
    setError(null)
    let objectUrl: string | null = null
    try {
      const blob = await apiFetchVoiceMessageBlob(message.id)
      objectUrl = URL.createObjectURL(blob)
      const audio = new Audio(objectUrl)
      const cleanup = () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
      audio.addEventListener('ended', cleanup, { once: true })
      audio.addEventListener('error', cleanup, { once: true })
      await audio.play()
      const result = await apiMarkVoiceMessageListened(message.id)
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, listenedAt: result.listenedAt } : m)))
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setError('Le message vocal n\'a pas pu être lu.')
    } finally {
      setConsumingId(null)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <TopBar title="Messages" eyebrow="Vocaux hors ligne" />

      <main className="mx-auto max-w-md px-5 pt-4">
        {loading && <p className="text-sm text-paperDim">Chargement...</p>}

        {error && !loading && (
          <div className="mt-4 rounded-xl border border-alert/30 bg-alert/10 p-4 text-center">
            <p className="text-sm text-paper">{error}</p>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-line px-4 py-10 text-center">
            <p className="text-sm text-paperDim">
              Aucun message vocal. Quand un contact est hors ligne, vous pouvez lui laisser un vocal depuis
              son ecran de communication.
            </p>
          </div>
        )}

        {!loading && !error && messages.length > 0 && (
          <ul className="mt-4 space-y-3">
            {messages.map((m) => {
              const unread = !m.listenedAt
              const playing = playingId === m.id
              const consuming = consumingId === m.id
              return (
                <li
                  key={m.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    unread ? 'border-transmit/40 bg-transmit/5' : 'border-line bg-panel'
                  }`}
                >
                  <Avatar
                    name={m.sender.displayName}
                    color={m.sender.avatarColor}
                    avatarUrl={m.sender.avatarUrl}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-display text-sm font-medium text-paper">
                        {m.sender.displayName}
                      </p>
                      <span className="callsign shrink-0 text-[11px] text-paperDim">
                        {formatDuration(m.durationSec)}
                      </span>
                    </div>
                    <p className="text-xs text-paperDim">
                      {formatTimestamp(m.createdAt)}
                      {m.viewOnce && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-transmit">
                          <Eye size={10} /> écoute unique
                        </span>
                      )}
                    </p>
                  </div>

                  {m.viewOnce && m.listenedAt ? (
                    // Theme 2 : fichier deja supprime du disque, plus rien a jouer.
                    <span className="flex items-center gap-1 shrink-0 text-[11px] italic text-paperDim">
                      <EyeOff size={13} /> écouté
                    </span>
                  ) : m.viewOnce ? (
                    <button
                      onClick={() => void playViewOnceVoiceMessage(m)}
                      disabled={consuming}
                      aria-label={`Écouter une seule fois le message de ${m.sender.displayName}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel2 text-paper hover:bg-line disabled:opacity-50"
                    >
                      {consuming ? (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-transmit" aria-hidden="true" />
                      ) : (
                        <Play size={16} className="ml-0.5" />
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => togglePlay(m)}
                      aria-label={
                        playing ? `Mettre en pause le message de ${m.sender.displayName}` : `Ecouter le message de ${m.sender.displayName}`
                      }
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                        playing ? 'bg-transmit text-ink' : 'bg-panel2 text-paper hover:bg-line'
                      }`}
                    >
                      {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                    </button>
                  )}

                  {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-transmit" aria-hidden="true" />}
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
