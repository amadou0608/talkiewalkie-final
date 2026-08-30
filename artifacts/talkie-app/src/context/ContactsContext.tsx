// Contexte contacts — Phase 4, presence temps reel en Phase 5.
// Centralise la liste des contacts (chargee une fois, partagee par Home,
// Contacts, conversations et Messages) pour eviter que chaque page refasse son propre
// appel et affiche des donnees incoherentes entre elles.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  apiAddContact,
  apiBlockContact,
  apiListBlocked,
  apiListContacts,
  apiRemoveContact,
  apiSetReadReceipts,
  apiUnblockContact,
} from '@/lib/contactsApi'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'
import { useAuth } from './AuthContext'
import type { Contact, PresenceStatus } from '@/types'

interface ContactsContextValue {
  accepted: Contact[]
  pending: Contact[]
  blocked: Contact[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  refreshBlocked: () => Promise<void>
  addContact: (username: string) => Promise<Contact>
  removeContact: (contactUserId: string) => Promise<void>
  blockContact: (contactUserId: string) => Promise<void>
  unblockContact: (contactUserId: string) => Promise<void>
  toggleReadReceipts: (contactUserId: string, hide: boolean) => Promise<void>
  findById: (userId: string | undefined) => Contact | undefined
}

const ContactsContext = createContext<ContactsContextValue | undefined>(undefined)

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [accepted, setAccepted] = useState<Contact[]>([])
  const [pending, setPending] = useState<Contact[]>([])
  const [blocked, setBlocked] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { accepted: a, pending: p } = await apiListContacts()
      setAccepted(a)
      setPending(p)
    } catch {
      setError('Impossible de charger vos contacts.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshBlocked = useCallback(async () => {
    try {
      setBlocked(await apiListBlocked())
    } catch {
      // La liste des bloques n'est consultee que sur /blocked ; une erreur
      // ici ne doit pas casser le reste de l'app.
    }
  }, [])

  // Ne charge les contacts qu'une fois une session confirmee (sinon /contacts
  // renverrait 401 avant meme que la restauration de session ait fini).
  useEffect(() => {
    if (status === 'authenticated') {
      refresh()
    } else if (status === 'unauthenticated') {
      setAccepted([])
      setPending([])
      setBlocked([])
      setLoading(false)
    }
  }, [status, refresh])

  // Presence temps reel (Phase 5) : le serveur pousse un evenement des
  // qu'un contact passe en ligne/hors ligne (voir backend/src/realtime).
  // On ne fait que mettre a jour l'entree correspondante localement — pas de
  // nouveau fetch REST necessaire pour un simple changement de statut.
  useEffect(() => {
    if (status !== 'authenticated') {
      disconnectSocket()
      return
    }

    connectSocket()
    const socket = getSocket()

    const applyPresence = (update: { userId: string; status: PresenceStatus; lastSeen: string }) => {
      const patch = (list: Contact[]) =>
        list.map((c) =>
          c.user.id === update.userId
            ? { ...c, user: { ...c.user, status: update.status, lastSeen: update.lastSeen } }
            : c,
        )
      setAccepted(patch)
      setPending(patch)
    }

    socket.on('presence:update', applyPresence)
    return () => {
      socket.off('presence:update', applyPresence)
    }
  }, [status])

  const addContact = useCallback(
    async (username: string) => {
      const contact = await apiAddContact(username)
      await refresh()
      return contact
    },
    [refresh],
  )

  const removeContact = useCallback(
    async (contactUserId: string) => {
      await apiRemoveContact(contactUserId)
      setAccepted((prev) => prev.filter((c) => c.user.id !== contactUserId))
      setPending((prev) => prev.filter((c) => c.user.id !== contactUserId))
    },
    [],
  )

  const blockContact = useCallback(
    async (contactUserId: string) => {
      await apiBlockContact(contactUserId)
      setAccepted((prev) => prev.filter((c) => c.user.id !== contactUserId))
      setPending((prev) => prev.filter((c) => c.user.id !== contactUserId))
      await refreshBlocked()
    },
    [refreshBlocked],
  )

  const unblockContact = useCallback(
    async (contactUserId: string) => {
      await apiUnblockContact(contactUserId)
      setBlocked((prev) => prev.filter((c) => c.user.id !== contactUserId))
    },
    [],
  )

  // Theme 2 : bascule locale optimiste, puis appel serveur. En cas d'echec,
  // on revient a l'etat precedent pour ne pas afficher un toggle incoherent.
  const toggleReadReceipts = useCallback(
    async (contactUserId: string, hide: boolean) => {
      const patch = (list: Contact[]) =>
        list.map((c) => (c.user.id === contactUserId ? { ...c, hideReadReceipts: hide } : c))
      setAccepted(patch)
      try {
        await apiSetReadReceipts(contactUserId, hide)
      } catch (err) {
        setAccepted((prev) =>
          prev.map((c) => (c.user.id === contactUserId ? { ...c, hideReadReceipts: !hide } : c)),
        )
        throw err
      }
    },
    [],
  )

  const findById = useCallback(
    (userId: string | undefined) => {
      if (!userId) return undefined
      return [...accepted, ...pending].find((c) => c.user.id === userId)
    },
    [accepted, pending],
  )

  const value = useMemo(
    () => ({
      accepted,
      pending,
      blocked,
      loading,
      error,
      refresh,
      refreshBlocked,
      addContact,
      removeContact,
      blockContact,
      unblockContact,
      toggleReadReceipts,
      findById,
    }),
    [accepted, pending, blocked, loading, error, refresh, refreshBlocked, addContact, removeContact, blockContact, unblockContact, toggleReadReceipts, findById],
  )

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>
}

export function useContacts(): ContactsContextValue {
  const ctx = useContext(ContactsContext)
  if (!ctx) throw new Error('useContacts doit etre utilise a l\'interieur de <ContactsProvider>')
  return ctx
  }
