// WebSocket client partagé par toute l'application.
// La présence et les futurs événements de messagerie utilisent cette instance. Le cookie de session httpOnly est envoye
// automatiquement grace a `withCredentials: true` — pas de token a gerer
// manuellement cote client.
import { io, type Socket } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      path: '/api/socket.io',
      withCredentials: true,
      autoConnect: false,
    })
  }
  return socket
}

// Appele par ContactsContext une fois la session confirmee (voir Phase 5 :
// la presence ne doit s'activer qu'apres authentification).
export function connectSocket(): void {
  const s = getSocket()
  if (!s.connected) s.connect()
}

// Appele a la deconnexion (logout) : evite qu'un socket authentifie pour un
// utilisateur reste ouvert une fois la session locale effacee.
export function disconnectSocket(): void {
  socket?.disconnect()
}
