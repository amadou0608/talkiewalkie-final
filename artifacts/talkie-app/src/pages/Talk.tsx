import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CheckCheck, Mic, Square, Send, X, Camera, Image as ImageIcon, Video, Pencil, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '@/components/Avatar'
import StatusDot from '@/components/StatusDot'
import { useContacts } from '@/context/ContactsContext'
import { useAuth } from '@/context/AuthContext'
import { compressImage } from '@/lib/imageCompression'
import { apiListMessages, apiMarkMessageDelivered, apiMarkConversationRead, apiSendTextMessage, apiSendVoiceChatMessage, apiSendImageMessage, apiSendVideoMessage, apiEditTextMessage, apiGetEditHistory, apiDeleteMessage, chatVoiceUrl, chatImageUrl, chatVideoUrl } from '@/lib/messagesApi'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { connectSocket, getSocket } from '@/lib/socket'
import type { ChatMessage, MessageEditHistoryEntry } from '@/types'

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const EDIT_WINDOW_MS = 20 * 60 * 1000

function editRemainingMinutes(createdAt: string) {
  const remaining = EDIT_WINDOW_MS - (Date.now() - new Date(createdAt).getTime())
  return remaining > 0 ? Math.ceil(remaining / 60000) : 0
}

export default function Talk() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { findById } = useContacts()
  const contact = findById(userId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [pendingSend, setPendingSend] = useState<{ content: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null)
const [historyEntries, setHistoryEntries] = useState<MessageEditHistoryEntry[]>([])
const [historyLoading, setHistoryLoading] = useState(false)
  const recorder = useVoiceRecorder()
  const [voiceSending, setVoiceSending] = useState(false)
  const [imageSending, setImageSending] = useState(false)
  const [videoSending, setVideoSending] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<{ file: File; url: string; durationSec: number } | null>(null)
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const videoGalleryInputRef = useRef<HTMLInputElement | null>(null)
  const videoCameraInputRef = useRef<HTMLInputElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [, forceTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const otherUser = contact?.user
  const title = otherUser?.displayName ?? 'Conversation'

  const mergeMessage = (incoming: ChatMessage) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === incoming.id)
      if (index === -1) return [...prev, incoming].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      const copy = [...prev]
      copy[index] = { ...copy[index], ...incoming }
      return copy
    })
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    apiListMessages(userId).then((items) => {
      if (!cancelled) setMessages(items)
    }).catch(() => {
      if (!cancelled) setError('Impossible de charger la conversation.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    apiMarkConversationRead(userId).catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!userId || !user) return
    connectSocket()
    const socket = getSocket()
    const onNew = (message: ChatMessage) => {
      if (!((message.senderId === user.id && message.receiverId === userId) || (message.senderId === userId && message.receiverId === user.id))) return
      mergeMessage(message)
      if (message.receiverId === user.id) {
        apiMarkMessageDelivered(message.id).catch(() => {})
        apiMarkConversationRead(userId).catch(() => {})
      }
    }
    const onStatus = (update: { messageId: string; status: ChatMessage['status'] }) => {
      setMessages((prev) => prev.map((m) => m.id === update.messageId ? { ...m, status: update.status } : m))
    }
    const onUpdated = (message: ChatMessage) => { if (message.senderId === userId || message.receiverId === userId) mergeMessage(message) }
    const onDeleted = (update: { messageId: string }) => setMessages((prev) => prev.filter((m) => m.id !== update.messageId))
    const onTyping = (update: { userId: string; isTyping: boolean }) => { if (update.userId === userId) setTyping(update.isTyping) }
    socket.on('message:new', onNew)
    socket.on('message:status', onStatus)
    socket.on('message:updated', onUpdated)
    socket.on('message:deleted', onDeleted)
    socket.on('typing:update', onTyping)
    return () => {
      socket.off('message:new', onNew)
      socket.off('message:status', onStatus)
      socket.off('message:updated', onUpdated)
      socket.off('message:deleted', onDeleted)
      socket.off('typing:update', onTyping)
    }
  }, [userId, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function emitTyping(isTyping: boolean) {
    if (!userId) return
    const socket = getSocket()
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', userId)
  }
  function handleTextChange(value: string) {
    setText(value)
    emitTyping(value.trim().length > 0)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => emitTyping(false), 1200)
  }

  const canSend = useMemo(() => text.trim().length > 0 && !sending && !!userId, [text, sending, userId])

  async function actuallySendMessage(content: string) {
    if (!userId) return
    setSending(true)
    setError(null)
    try {
      const message = await apiSendTextMessage(userId, content)
      mergeMessage(message)
    } catch {
      setError('Le message n\'a pas pu être envoyé.')
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSend || !userId) return
    const content = text.trim()
    emitTyping(false)
    setText('')
    setError(null)
    const timeoutId = setTimeout(() => {
      setPendingSend(null)
      void actuallySendMessage(content)
    }, 5000)
    setPendingSend({ content, timeoutId })
  }

  function cancelPendingSend() {
    if (!pendingSend) return
    clearTimeout(pendingSend.timeoutId)
    setText(pendingSend.content)
    setPendingSend(null)
                                                                                 }

  function handleImageFile(file?: File) {
    if (!file || !userId || imageSending) return
    if (!file.type.startsWith('image/')) { setError('Veuillez sélectionner une image.'); return }
    if (imagePreview) URL.revokeObjectURL(imagePreview.url)
    setError(null)
    setImagePreview({ file, url: URL.createObjectURL(file) })
  }

  function cancelImagePreview() {
    if (imagePreview) URL.revokeObjectURL(imagePreview.url)
    setImagePreview(null)
  }

  async function sendImagePreview() {
    if (!imagePreview || !userId || imageSending) return
    setImageSending(true)
    setError(null)
    try {
      const compressed = await compressImage(imagePreview.file)
      const message = await apiSendImageMessage(userId, compressed, `photo-${Date.now()}.jpg`)
      mergeMessage(message)
      cancelImagePreview()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La photo n’a pas pu être envoyée.')
    } finally {
      setImageSending(false)
    }
  }

  async function handleVideoFile(file?: File) {
    if (!file || !userId || videoSending) return
    if (!file.type.startsWith('video/')) { setError('Veuillez sélectionner une vidéo.'); return }
    if (file.size > 60 * 1024 * 1024) { setError('La vidéo est trop volumineuse. Limite : 60 Mo.'); return }
    if (videoPreview) URL.revokeObjectURL(videoPreview.url)
    const url = URL.createObjectURL(file)
    setError(null)
    try {
      const durationSec = await new Promise<number>((resolve, reject) => {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
          const duration = video.duration
          if (!Number.isFinite(duration) || duration <= 0) reject(new Error('Durée vidéo illisible.'))
          else resolve(duration)
        }
        video.onerror = () => { URL.revokeObjectURL(video.src); reject(new Error('Impossible de lire les informations de la vidéo.')) }
        video.src = url
      })
      if (durationSec > 300) {
        URL.revokeObjectURL(url)
        setError('La vidéo ne doit pas dépasser 5 minutes.')
        return
      }
      setVideoPreview({ file, url, durationSec })
    } catch (err) {
      URL.revokeObjectURL(url)
      setError(err instanceof Error ? err.message : 'La vidéo n’a pas pu être préparée.')
    }
  }

  function cancelVideoPreview() {
    if (videoPreview) URL.revokeObjectURL(videoPreview.url)
    setVideoPreview(null)
  }

  async function sendVideoPreview() {
    if (!videoPreview || !userId || videoSending) return
    setVideoSending(true)
    setError(null)
    try {
      const extension = videoPreview.file.name.split('.').pop() || 'mp4'
      const message = await apiSendVideoMessage(userId, videoPreview.file, videoPreview.durationSec, `video-${Date.now()}.${extension}`)
      mergeMessage(message)
      cancelVideoPreview()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La vidéo n’a pas pu être envoyée.')
    } finally {
      setVideoSending(false)
    }
  }

  async function saveEdit(messageId: string) {
    const content = editText.trim()
    if (!content) return
    try {
      const updated = await apiEditTextMessage(messageId, content)
      mergeMessage(updated)
      setEditingId(null)
      setEditText('')
    } catch { setError('Le message n’a pas pu être modifié.') }
  }
async function openHistory(messageId: string) {
    setHistoryFor(messageId)
    setHistoryLoading(true)
    try {
      const entries = await apiGetEditHistory(messageId)
      setHistoryEntries(entries)
    } catch {
      setError('Impossible de charger l’historique.')
      setHistoryFor(null)
    } finally {
      setHistoryLoading(false)
    }
        }
  async function removeMessage(messageId: string) {
    if (!window.confirm('Supprimer ce message pour tout le monde ?')) return
    try { await apiDeleteMessage(messageId); setMessages((prev) => prev.filter((m) => m.id !== messageId)) }
    catch { setError('Le message n’a pas pu être supprimé.') }
  }

  async function toggleRecording() {
    if (!userId || voiceSending) return
    setError(null)
    if (recorder.state === 'recording') {
      setVoiceSending(true)
      try {
        const result = await recorder.stop()
        if (!result) return
        const message = await apiSendVoiceChatMessage(userId, result.blob, result.durationSec)
        mergeMessage(message)
      } catch {
        setError('Le message vocal n’a pas pu être envoyé.')
      } finally {
        setVoiceSending(false)
      }
      return
    }
    try {
      await recorder.start()
    } catch {
      setError('Le microphone n’a pas pu être activé.')
    }
  }

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview.url)
    if (videoPreview) URL.revokeObjectURL(videoPreview.url)
  }, [imagePreview, videoPreview])

  if (!otherUser) {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-paperDim">Contact introuvable.</div>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="safe-top flex items-center gap-3 border-b border-line px-4 pb-3 pt-4">
        <button onClick={() => navigate('/')} aria-label="Retour" className="rounded-full p-2 text-paperDim hover:bg-panel2 hover:text-paper"><ArrowLeft size={20} /></button>
        <Avatar name={otherUser.displayName} color={otherUser.avatarColor} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-paper">{title}</p>
          <StatusDot status={otherUser.status} showLabel />
        </div>
      </header>

      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; void handleImageFile(file); e.currentTarget.value = '' }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; void handleImageFile(file); e.currentTarget.value = '' }} />
      <input ref={videoGalleryInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; void handleVideoFile(file); e.currentTarget.value = '' }} />
      <input ref={videoCameraInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; void handleVideoFile(file); e.currentTarget.value = '' }} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-4 py-5">
        {loading && <p className="m-auto text-sm text-paperDim">Chargement de la conversation...</p>}
        {!loading && messages.length === 0 && <p className="m-auto max-w-xs text-center text-sm text-paperDim">Aucun message. Envoyez le premier message à {otherUser.displayName}.</p>}
        {!loading && messages.length > 0 && (
          <div className="mt-auto space-y-2">
            {messages.map((message) => {
              const mine = message.senderId === user?.id
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 ${mine ? 'rounded-br-md bg-transmit text-ink' : 'rounded-bl-md border border-line bg-panel text-paper'}`}>
                    {message.type === 'voice' ? (
                      <div className="min-w-[210px]">
                        <audio
                          controls
                          preload="metadata"
                          crossOrigin="use-credentials"
                          src={chatVoiceUrl(message.id)}
                          className="w-full max-w-[240px]"
                          onPlay={() => {
                            if (!mine && message.status !== 'read') {
                              // La lecture inline est déjà sécurisée côté serveur ; le statut 'read' sera finalisé en phase 18.
                            }
                          }}
                          aria-label={`Message vocal de ${message.sender.displayName}`}
                        />
                        <p className={`mt-1 text-[10px] ${mine ? 'text-ink/70' : 'text-paperDim'}`}>{message.durationSec ?? 0}s</p>
                      </div>
                    ) : message.type === 'image' ? (
                      <button type="button" onClick={() => setLightbox(chatImageUrl(message.id))} className="block overflow-hidden rounded-xl" aria-label="Ouvrir la photo en plein écran">
                        <img src={chatImageUrl(message.id)} alt="Photo envoyée" loading="lazy" className="max-h-80 w-full max-w-[280px] object-cover" />
                      </button>
                    ) : message.type === 'video' ? (
                      <div className="overflow-hidden rounded-xl">
                        <video controls preload="metadata" crossOrigin="use-credentials" src={chatVideoUrl(message.id)} className="max-h-80 w-full max-w-[300px] rounded-xl" aria-label={`Vidéo envoyée par ${message.sender.displayName}`} />
                        <p className={`mt-1 px-1 text-[10px] ${mine ? 'text-ink/70' : 'text-paperDim'}`}>{message.durationSec ? `${Math.ceil(message.durationSec)}s` : ''}</p>
                      </div>
                    ) : editingId === message.id ? (
                      <div className="space-y-2"><textarea value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={4000} className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-sm text-paper" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="text-xs text-paperDim">Annuler</button><button type="button" onClick={() => void saveEdit(message.id)} className="text-xs font-semibold">Enregistrer</button></div></div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                        {message.editedAt && (
  <button type="button" onClick={() => void openHistory(message.id)} className="ml-1 text-[9px] underline opacity-60 hover:opacity-100">modifié</button>
)}
                        {mine && !message.editedAt && editRemainingMinutes(message.createdAt) > 0 && (
                          <span className="ml-1 text-[9px] opacity-40">· modifiable {editRemainingMinutes(message.createdAt)} min</span>
                        )}
                      </>
                    )}
                    <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-ink/70' : 'text-paperDim'}`}>
                      <span>{timeLabel(message.createdAt)}</span>
                      {mine && !message.deletedAt && <>{message.type === 'text' && editRemainingMinutes(message.createdAt) > 0 && (
                        <button type="button" title={`Modifiable encore ${editRemainingMinutes(message.createdAt)} min`} onClick={() => { setEditingId(message.id); setEditText(message.content ?? '') }} className="ml-1 opacity-70 hover:opacity-100"><Pencil size={11} /></button>
                      )}<button type="button" title="Supprimer pour tout le monde" onClick={() => void removeMessage(message.id)} className="opacity-70 hover:opacity-100"><Trash2 size={11} /></button></>}
                      {mine && (
                        <span
                          title={message.status === 'sent' ? 'Envoyé' : message.status === 'delivered' ? 'Reçu' : 'Lu'}
                          aria-label={message.status === 'sent' ? 'Message envoyé' : message.status === 'delivered' ? 'Message reçu' : 'Message lu'}
                          className={message.status === 'read' ? 'text-sky-400' : 'text-paperDim'}
                        >
                          {message.status === 'sent' ? <Check size={13} /> : <CheckCheck size={13} />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
        {typing && <p className="mt-3 text-xs italic text-paperDim">{otherUser.displayName} est en train d’écrire…</p>}
        {error && <p className="mt-3 text-center text-xs text-alert">{error}</p>}
      </main><form onSubmit={handleSubmit} className="safe-bottom border-t border-line bg-ink/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-end gap-2">
          {recorder.state === 'recording' ? (
            <div className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border border-alert/40 bg-panel px-4">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-alert" aria-hidden="true" />
              <span className="flex-1 text-sm text-paper">Enregistrement… {recorder.elapsedSec}s</span>
              <button type="button" onClick={recorder.cancel} aria-label="Annuler le vocal" className="rounded-full p-2 text-paperDim hover:bg-panel2 hover:text-paper"><X size={17} /></button>
            </div>
          ) : (
            <>
            <div className="flex shrink-0 gap-1">
              <button type="button" disabled={imageSending || videoSending || voiceSending} onClick={() => galleryInputRef.current?.click()} aria-label="Choisir une photo" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-paper disabled:opacity-40"><ImageIcon size={17} /></button>
              <button type="button" disabled={imageSending || videoSending || voiceSending} onClick={() => cameraInputRef.current?.click()} aria-label="Prendre une photo" className="hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-paper disabled:opacity-40 sm:flex"><Camera size={17} /></button>
              <button type="button" disabled={imageSending || videoSending || voiceSending} onClick={() => videoGalleryInputRef.current?.click()} aria-label="Choisir une vidéo" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-paper disabled:opacity-40"><Video size={17} /></button>
              <button type="button" disabled={imageSending || videoSending || voiceSending} onClick={() => videoCameraInputRef.current?.click()} aria-label="Enregistrer une vidéo" className="hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-paper disabled:opacity-40 sm:flex"><Camera size={17} /></button>
            </div>
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
              rows={1}
              maxLength={4000}
              placeholder="Écrire un message..."
              aria-label="Message"
              disabled={voiceSending}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-paper outline-none placeholder:text-paperDim focus:border-transmit"
            />
            </>
          )}
          {recorder.state === 'recording' ? (
            <button type="button" disabled={voiceSending} onClick={toggleRecording} aria-label="Arrêter et envoyer le vocal" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-alert text-ink disabled:opacity-40">
              <Square size={16} fill="currentColor" />
            </button>
          ) : canSend ? (
            <button disabled={!canSend} aria-label="Envoyer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transmit text-ink disabled:cursor-not-allowed disabled:opacity-40">
              <Send size={17} />
            </button>
          ) : (
            <button type="button" disabled={voiceSending} onClick={toggleRecording} aria-label="Enregistrer un message vocal" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-paper disabled:opacity-40">
              <Mic size={17} />
            </button>
          )}
        </div>
      </form>
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display text-sm font-semibold text-paper">Aperçu de la photo</p>
              <button type="button" onClick={cancelImagePreview} aria-label="Fermer l’aperçu" className="rounded-full p-2 text-paperDim hover:bg-panel2 hover:text-paper"><X size={19} /></button>
            </div>
            <div className="flex max-h-[65vh] justify-center bg-black p-3"><img src={imagePreview.url} alt="Aperçu de la photo à envoyer" className="max-h-[60vh] max-w-full rounded-xl object-contain" /></div>
            <div className="flex gap-2 p-3">
              <button type="button" onClick={cancelImagePreview} disabled={imageSending} className="flex-1 rounded-xl border border-line px-4 py-3 text-sm text-paper disabled:opacity-40">Annuler</button>
              <button type="button" onClick={() => void sendImagePreview()} disabled={imageSending} className="flex-1 rounded-xl bg-transmit px-4 py-3 text-sm font-semibold text-ink disabled:opacity-40">{imageSending ? 'Envoi…' : 'Envoyer'}</button>
            </div>
          </div>
        </div>
      )}
      {videoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display text-sm font-semibold text-paper">Aperçu de la vidéo</p>
              <button type="button" onClick={cancelVideoPreview} aria-label="Fermer l’aperçu vidéo" className="rounded-full p-2 text-paperDim hover:bg-panel2 hover:text-paper"><X size={19} /></button>
            </div>
            <div className="flex max-h-[65vh] justify-center bg-black p-3"><video src={videoPreview.url} controls playsInline preload="metadata" className="max-h-[60vh] max-w-full rounded-xl" /></div>
            <div className="flex items-center justify-between gap-2 border-t border-line p-3">
              <span className="text-xs text-paperDim">Durée : {Math.ceil(videoPreview.durationSec)}s · maximum 5 min</span>
              <div className="flex gap-2">
                <button type="button" onClick={cancelVideoPreview} disabled={videoSending} className="rounded-xl border border-line px-4 py-3 text-sm text-paper disabled:opacity-40">Annuler</button>
                <button type="button" onClick={() => void sendVideoPreview()} disabled={videoSending} className="rounded-xl bg-transmit px-4 py-3 text-sm font-semibold text-ink disabled:opacity-40">{videoSending ? 'Envoi…' : 'Envoyer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {historyFor && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-display text-sm font-semibold text-paper">Historique des modifications</p>
        <button type="button" onClick={() => setHistoryFor(null)} aria-label="Fermer l’historique" className="rounded-full p-2 text-paperDim hover:bg-panel2 hover:text-paper"><X size={19} /></button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
        {historyLoading && <p className="text-sm text-paperDim">Chargement…</p>}
        {!historyLoading && historyEntries.length === 0 && <p className="text-sm text-paperDim">Aucune version antérieure.</p>}
        {!historyLoading && historyEntries.map((entry, i) => (
          <div key={i} className="rounded-xl border border-line bg-panel2 px-3 py-2">
            <p className="whitespace-pre-wrap break-words text-sm text-paper">{entry.previousContent}</p>
            <p className="mt-1 text-[10px] text-paperDim">{timeLabel(entry.editedAt)}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" onClick={() => setLightbox(null)} aria-label="Fermer" className="absolute right-4 top-4 rounded-full bg-black/50 p-3 text-white"><X size={22} /></button>
          <img src={lightbox} alt="Photo en plein écran" className="max-h-[90vh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
                }
