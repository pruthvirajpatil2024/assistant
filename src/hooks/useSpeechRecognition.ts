import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSpeechRecognitionResult {
  transcript: string
  isRecording: boolean
  isSupported: boolean
  start: () => void
  stop: () => Promise<string>
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef('')
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
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current}${text} `.replace(/\s+/g, ' ')
        } else {
          interim += text
        }
      }
      setTranscript(`${finalTranscriptRef.current}${interim}`.trim())
    }

    recognition.onerror = () => {
      // Routine during continuous listening (e.g. 'no-speech') — ignore.
    }

    recognition.onend = () => {
      if (wantRecordingRef.current) {
        // Browser auto-stopped (silence timeout) but the user hasn't pressed
        // STOP — resume so "continuous" listening actually feels continuous.
        try {
          recognition.start()
        } catch {
          // already starting
        }
        return
      }
      setIsRecording(false)
      if (stopResolverRef.current) {
        stopResolverRef.current(finalTranscriptRef.current.trim())
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
    finalTranscriptRef.current = ''
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
      return Promise.resolve(finalTranscriptRef.current.trim())
    }
    return new Promise((resolve) => {
      stopResolverRef.current = resolve
      recognitionRef.current!.stop()
      // Safety net in case 'onend' never fires.
      setTimeout(() => {
        if (stopResolverRef.current) {
          stopResolverRef.current(finalTranscriptRef.current.trim())
          stopResolverRef.current = null
          setIsRecording(false)
        }
      }, 1200)
    })
  }, [])

  return { transcript, isRecording, isSupported, start, stop }
}
