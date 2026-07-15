import { useCallback, useRef } from 'react'

interface UseAudioRecorderResult {
  /** Requests mic access and starts recording. Throws if unavailable —
   * callers should treat that as "no robust transcript this time" and
   * fall back to the live Web Speech API captions instead. */
  start: () => Promise<void>
  /** Stops recording and resolves with the captured audio, or null if
   * nothing was recorded (never started, or start() had failed). */
  stop: () => Promise<Blob | null>
}

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Audio recording is not supported in this browser')
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    // Small timeslice so we still have most of the audio even if something
    // goes wrong mid-recording, instead of losing it all at once.
    recorder.start(250)
    recorderRef.current = recorder
    streamRef.current = stream
  }, [])

  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current
    const stream = streamRef.current
    if (!recorder || recorder.state === 'inactive') {
      stream?.getTracks().forEach((track) => track.stop())
      recorderRef.current = null
      streamRef.current = null
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null
        chunksRef.current = []
        stream?.getTracks().forEach((track) => track.stop())
        recorderRef.current = null
        streamRef.current = null
        resolve(blob)
      }
      recorder.stop()
    })
  }, [])

  return { start, stop }
}
