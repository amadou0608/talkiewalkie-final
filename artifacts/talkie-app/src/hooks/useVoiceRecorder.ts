// Enregistrement d'un message vocal — Phase 8 (section 10 du cahier des
// charges : "Envoyer un message vocal" quand le destinataire est hors
// ligne). Utilise MediaRecorder plutot que WebRTC : il n'y a personne en
// face a connecter en temps reel, seulement un fichier a produire puis
// envoyer via POST /voice-messages (voir lib/voiceMessagesApi.ts).
import { useCallback, useEffect, useRef, useState } from 'react'

// Doit rester coherent avec MAX_VOICE_MESSAGE_DURATION_SEC cote backend
// (voir backend/src/modules/voice-messages/voice-messages.schemas.ts) :
// on coupe l'enregistrement cote client avant meme d'atteindre une limite
// que le serveur rejetterait de toute facon.
export const MAX_RECORDING_SEC = 180

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'mic-denied' | 'error'

interface UseVoiceRecorderResult {
  state: RecorderState
  elapsedSec: number
  start: () => Promise<void>
  // Resout avec le vocal enregistre, ou null si rien n'a pu etre capture
  // (ex. stop() appele avant que le moindre chunk n'arrive).
  stop: () => Promise<{ blob: Blob; durationSec: number } | null>
  cancel: () => void
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) {
      return type
    }
  }
  return '' // laisse le navigateur choisir son defaut
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopResolveRef = useRef<((result: { blob: Blob; durationSec: number } | null) => void) | null>(null)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const clearTick = useCallback(() => {
    if (tickIntervalRef.current !== null) clearInterval(tickIntervalRef.current)
    tickIntervalRef.current = null
  }, [])

  // Nettoyage si le composant est demonte pendant un enregistrement en cours
  // (ex. l'utilisateur quitte /talk sans avoir termine).
  useEffect(() => {
    return () => {
      clearTick()
      recorderRef.current?.stop()
      releaseStream()
    }
  }, [clearTick, releaseStream])

  const start = useCallback(async () => {
    setState('requesting')
    setElapsedSec(0)
    chunksRef.current = []

    let stream: MediaStream
    try {
      // Memes contraintes que l'appel temps reel (section 19) : la qualite
      // attendue d'un vocal n'a pas de raison d'etre inferieure.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch {
      setState('mic-denied')
      return
    }

    streamRef.current = stream

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      releaseStream()
      setState('error')
      return
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      clearTick()
      const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: mimeType || 'audio/webm' }) : null
      releaseStream()
      stopResolveRef.current?.(blob ? { blob, durationSec } : null)
      stopResolveRef.current = null
    }

    recorderRef.current = recorder
    startedAtRef.current = Date.now()
    recorder.start()
    setState('recording')

    tickIntervalRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsedSec(sec)
      // Coupe automatiquement a la limite plutot que de laisser le serveur
      // rejeter un fichier trop long apres coup (section 13 : validation).
      if (sec >= MAX_RECORDING_SEC) {
        recorderRef.current?.stop()
      }
    }, 250)
  }, [clearTick, releaseStream])

  const stop = useCallback((): Promise<{ blob: Blob; durationSec: number } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      stopResolveRef.current = resolve
      setState('idle')
      recorder.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    clearTick()
    const recorder = recorderRef.current
    // Empeche onstop de renvoyer un blob a un appelant qui a deja abandonne.
    stopResolveRef.current = null
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    releaseStream()
    setState('idle')
    setElapsedSec(0)
  }, [clearTick, releaseStream])

  return { state, elapsedSec, start, stop, cancel }
}
