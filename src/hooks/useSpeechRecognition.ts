import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSpeechRecognitionResult {
  transcript: string
  isRecording: boolean
  isSupported: boolean
  start: () => void
  stop: () => Promise<string>
}

// How many trailing words of the committed transcript to check a
// just-after-restart chunk against. Wide enough to catch short repeated
// phrases (e.g. "what is" repeating), narrow enough to stay well clear of
// ordinary word recurrence in normal speech.
const RESTART_ECHO_WINDOW_WORDS = 6

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?]+$/, '')
}

function wordsOf(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean)
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const committedRef = useRef('')
  // Android Chrome's "continuous" mode silently restarts every few seconds,
  // and the fresh session often re-emits (as new "final" results) words or
  // short phrases it had just finalized right before the restart. This flag
  // scopes the extra duplicate-check to only that just-after-restart window,
  // so ordinary word recurrence in normal speech is never touched by it.
  const justRestartedRef = useRef(false)
  const wantRecordingRef = useRef(false)
  const stopResolverRef = useRef<((value: string) => void) | null>(null)

  const Ctor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined
  const isSupported = Boolean(Ctor)

  useEffect(() => {
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = (result[0]?.transcript ?? '').trim()
        if (!text) continue

        if (result.isFinal) {
          if (justRestartedRef.current) {
            const chunkWords = wordsOf(text)
            const recentWindow = wordsOf(committedRef.current)
              .slice(-RESTART_ECHO_WINDOW_WORDS)
              .join(' ')
            const isEcho =
              chunkWords.length > 0 && recentWindow.includes(chunkWords.join(' '))
            if (isEcho) {
              continue // restart-artifact repeat of recently recognized speech
            }
            justRestartedRef.current = false // genuinely new content — stop checking
          }
          committedRef.current = `${committedRef.current} ${text}`.replace(/\s+/g, ' ').trim()
        } else {
          interim += (interim ? ' ' : '') + text
        }
      }
      setTranscript(`${committedRef.current} ${interim}`.replace(/\s+/g, ' ').trim())
    }

    recognition.onerror = () => {
      // Routine during continuous listening (e.g. 'no-speech') — ignore.
    }

    recognition.onend = () => {
      if (wantRecordingRef.current) {
        // Browser auto-stopped (silence timeout) but the user hasn't pressed
        // STOP — resume so "continuous" listening actually feels continuous.
        justRestartedRef.current = true
        try {
          recognition.start()
        } catch {
          // already starting
        }
        return
      }
      setIsRecording(false)
      if (stopResolverRef.current) {
        stopResolverRef.current(committedRef.current.trim())
        stopResolverRef.current = null
      }
    }

    recognitionRef.current = recognition
    return () => {
      wantRecordingRef.current = false
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
    }
  }, [Ctor])

  const start = useCallback(() => {
    if (!recognitionRef.current) return
    committedRef.current = ''
    justRestartedRef.current = false
    setTranscript('')
    wantRecordingRef.current = true
    setIsRecording(true)
    try {
      recognitionRef.current.start()
    } catch {
      // already started
    }
  }, [])

  const stop = useCallback((): Promise<string> => {
    wantRecordingRef.current = false
    if (!recognitionRef.current) {
      setIsRecording(false)
      return Promise.resolve(committedRef.current.trim())
    }
    return new Promise((resolve) => {
      stopResolverRef.current = resolve
      recognitionRef.current!.stop()
      // Safety net in case 'onend' never fires.
      setTimeout(() => {
        if (stopResolverRef.current) {
          stopResolverRef.current(committedRef.current.trim())
          stopResolverRef.current = null
          setIsRecording(false)
        }
      }, 1200)
    })
  }, [])

  return { transcript, isRecording, isSupported, start, stop }
}
