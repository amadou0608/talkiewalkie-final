// WebSocket — présence et futur transport temps réel de Talkie Chat.
//
// Sert deux besoins pour l'instant : (1) presence en ligne/hors ligne des
// contacts, en temps reel plutot qu'a chaque refresh de page ; (2) une base
// commune (auth par socket, rooms par utilisateur) que la Phase 6
// (signalisation WebRTC) reutilisera telle quelle — voir section 8 :
// "Utiliser le serveur uniquement pour : ... signalisation ; gestion des
// sessions ; ...".
//
// Portee volontaire de la Phase 5 : un seul process serveur (le Map en
// memoire ci-dessous ne survivrait pas a plusieurs instances). Suffisant
// pour un MVP ; passer par un adapter partage (ex. Redis) serait necessaire
// avant un deploiement multi-instance.
import { parse as parseCookie } from 'cookie'
import { Server as SocketIOServer, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { env } from '../env'
import { verifySession } from '../utils/jwt'
import { SESSION_COOKIE } from '../middleware/requireAuth'
import { getWatcherIds, markOffline, markOnline, type PresenceUpdate } from './presence.service'

// Delai avant de considerer un utilisateur "hors ligne" apres son dernier
// socket deconnecte. Absorbe les rechargements de page / reconnexions
// reseau breves sans faire clignoter le statut chez ses contacts.
const OFFLINE_GRACE_MS = 5_000

// userId -> sockets actuellement connectes (plusieurs onglets/appareils possibles).
const socketsByUser = new Map<string, Set<Socket>>()
// userId -> minuteur de passage "hors ligne" en attente (annule si reconnexion rapide).
const pendingOffline = new Map<string, NodeJS.Timeout>()

let io: SocketIOServer | null = null

// Room privée utilisée pour adresser un utilisateur sur tous ses appareils.
export function userRoom(userId: string): string {
  return `user:${userId}`
}

async function broadcastPresence(update: PresenceUpdate) {
  if (!io) return
  const watcherIds = await getWatcherIds(update.userId)
  for (const watcherId of watcherIds) {
    io.to(userRoom(watcherId)).emit('presence:update', update)
  }
}

function extractUserId(socket: Socket): string | null {
  const rawCookies = socket.handshake.headers.cookie
  if (!rawCookies) return null

  const cookies = parseCookie(rawCookies)
  const token = cookies[SESSION_COOKIE]
  if (!token) return null

  const payload = verifySession(token)
  return payload?.userId ?? null
}

async function handleConnection(socket: Socket, userId: string) {
  socket.data.userId = userId
  socket.join(userRoom(userId))

  socket.on('typing:start', (receiverId: string) => {
    if (typeof receiverId === 'string' && receiverId !== userId) {
      io?.to(userRoom(receiverId)).emit('typing:update', { userId, isTyping: true })
    }
  })
  socket.on('typing:stop', (receiverId: string) => {
    if (typeof receiverId === 'string' && receiverId !== userId) {
      io?.to(userRoom(receiverId)).emit('typing:update', { userId, isTyping: false })
    }
  })

  const existing = pendingOffline.get(userId)
  if (existing) {
    // Reconnexion avant expiration du delai de grace : on annule le passage
    // hors ligne, l'utilisateur n'a jamais vraiment quitte.
    clearTimeout(existing)
    pendingOffline.delete(userId)
  }

  const sockets = socketsByUser.get(userId) ?? new Set<Socket>()
  const wasOffline = sockets.size === 0
  sockets.add(socket)
  socketsByUser.set(userId, sockets)

  if (wasOffline) {
    const update = await markOnline(userId)
    await broadcastPresence(update)
  }

  socket.on('disconnect', () => {
    const remaining = socketsByUser.get(userId)
    remaining?.delete(socket)

    if (remaining && remaining.size === 0) {
      socketsByUser.delete(userId)
      const timer = setTimeout(async () => {
        pendingOffline.delete(userId)
        // Un autre socket a pu se reconnecter entre-temps (autre onglet).
        if (!socketsByUser.has(userId)) {
          const update = await markOffline(userId)
          await broadcastPresence(update)
        }
      }, OFFLINE_GRACE_MS)
      pendingOffline.set(userId, timer)
    }
  })
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: '/api/socket.io',
    cors: { origin: env.corsOrigin, credentials: true },
  })

  io.use((socket, next) => {
    const userId = extractUserId(socket)
    if (!userId) {
      next(new Error('UNAUTHENTICATED'))
      return
    }
    socket.data.userId = userId
    next()
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string
    handleConnection(socket, userId).catch((err) => {
      console.error('[socket] erreur a la connexion', err)
    })
  })

  return io
}

// Utilise par /auth/logout (section 5 : une deconnexion explicite doit faire
// passer hors ligne immediatement, sans attendre le delai de grace).
export function disconnectUserSockets(userId: string): void {
  const timer = pendingOffline.get(userId)
  if (timer) {
    clearTimeout(timer)
    pendingOffline.delete(userId)
  }

  const sockets = socketsByUser.get(userId)
  if (!sockets) return
  for (const socket of sockets) {
    socket.disconnect(true)
  }
  socketsByUser.delete(userId)
}

// Marque immediatement hors ligne et notifie les contacts, sans le delai de
// grace habituel. A appeler apres disconnectUserSockets() lors d'une
// deconnexion explicite (logout) — les deux sont separes pour que
// disconnectUserSockets() reste utilisable seul si necessaire ailleurs.
export async function forceOffline(userId: string): Promise<void> {
  const update = await markOffline(userId)
  await broadcastPresence(update)
}

export function getIO(): SocketIOServer | null {
  return io
}

// Notification temps reel generique vers tous les sockets d'un utilisateur
// (plusieurs onglets/appareils possibles, voir socketsByUser plus haut).
// Utilise par le module messages vocaux (Phase 8) pour rafraichir la boite
// de reception d'un destinataire deja connecte sans attendre un prochain
// fetch REST. Si l'utilisateur n'a aucun socket ouvert, l'emission est
// simplement sans effet — le message reste de toute facon recuperable via
// GET /voice-messages a la reconnexion (section 10). Un vrai reveil d'un
// destinataire completement hors ligne relevera de la Phase 9 (Web Push).
export function notifyUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload)
}

// Phase 9 (section 11) : sert a decider si un evenement doit AUSSI declencher
// une notification Web Push. Un utilisateur avec au moins un socket ouvert
// recoit deja l'evenement temps reel ci-dessus ; inutile de le reveiller en
// plus via push. Ne reflete que l'etat en memoire de ce process (voir la
// remarque en tete de fichier sur la portee mono-instance du MVP).
export function hasActiveSocket(userId: string): boolean {
  const sockets = socketsByUser.get(userId)
  return !!sockets && sockets.size > 0
}
