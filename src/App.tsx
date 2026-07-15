import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFullscreen } from './hooks/useFullscreen'
import { useOrientation } from './hooks/useOrientation'
import { useIsMobile } from './hooks/useIsMobile'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useAudioRecorder } from './hooks/useAudioRecorder'
import { RotatePrompt } from './components/RotatePrompt'
import { RecordButton, type ButtonState } from './components/RecordButton'
import { QuestionArea } from './components/QuestionArea'
import { AnswerDisplay } from './components/AnswerDisplay'
import './App.css'

type Phase = 'idle' | 'recording' | 'transcribing' | 'processing' | 'answered'

async function transcribeWithWhisper(blob: Blob): Promise<string | null> {
  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'content-type': blob.type || 'audio/webm' },
      body: blob,
    })
    const data = await res.json()
    if (res.ok && typeof data.text === 'string' && data.text.trim()) {
      return data.text.trim()
    }
  } catch {
    // Network/server error transcribing — caller falls back to live captions.
  }
  return null
}

function App() {
  const requestFullscreen = useFullscreen()
  const orientation = useOrientation()
  const isMobile = useIsMobile()
  const { transcript, isSupported, start, stop } = useSpeechRecognition()
  const audioRecorder = useAudioRecorder()

  const [phase, setPhase] = useState<Phase>('idle')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [sessionId, setSessionId] = useState(0)

  const beginRecording = useCallback(async () => {
    setQuestion('')
    setAnswer('')
    setError('')
    setSessionId((id) => id + 1)
    setPhase('recording')
    start()
    try {
      await audioRecorder.start()
    } catch {
      // Mic recording unavailable (permissions/unsupported) — live captions
      // still work, and finishRecording() falls back to that transcript.
    }
  }, [start, audioRecorder])

  const finishRecording = useCallback(async () => {
    setPhase('transcribing')
    const [liveTranscript, audioBlob] = await Promise.all([stop(), audioRecorder.stop()])

    let finalTranscript = liveTranscript.trim()
    if (audioBlob && audioBlob.size > 0) {
      const whisperText = await transcribeWithWhisper(audioBlob)
      if (whisperText) finalTranscript = whisperText
    }

    if (!finalTranscript) {
      setPhase('idle')
      return
    }

    setQuestion(finalTranscript)
    setPhase('processing')
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: finalTranscript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setAnswer(data.answer)
      setPhase('answered')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('answered')
    }
  }, [stop, audioRecorder])

  const handlePress = useCallback(() => {
    requestFullscreen()
    if (phase === 'idle' || phase === 'answered') {
      beginRecording()
    } else if (phase === 'recording') {
      finishRecording()
    }
  }, [phase, beginRecording, finishRecording, requestFullscreen])

  if (!isMobile) return <RotatePrompt reason="device" />
  if (orientation === 'portrait') return <RotatePrompt reason="orientation" />

  const buttonState: ButtonState =
    phase === 'processing' || phase === 'transcribing'
      ? 'processing'
      : phase === 'recording'
        ? 'recording'
        : 'idle'
  const liveQuestion = phase === 'recording' ? transcript : question

  return (
    <div className="app-shell">
      <div className="interview-grid">
        <div className="left-section">
          <QuestionArea text={liveQuestion} isLive={phase === 'recording'} />
          <AnimatePresence mode="wait">
            <motion.div
              key={sessionId}
              className="answer-area"
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -48 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {phase === 'transcribing' && <p className="idle-placeholder">Transcribing…</p>}
              {phase === 'processing' && <p className="idle-placeholder">Thinking…</p>}
              {phase === 'answered' && !error && <AnswerDisplay answer={answer} />}
              {phase === 'answered' && error && <p className="idle-placeholder">{error}</p>}
              {phase === 'idle' && !isSupported && (
                <p className="idle-placeholder">
                  Speech recognition isn't supported in this browser.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="right-section">
          <RecordButton state={buttonState} disabled={!isSupported} onPress={handlePress} />
        </div>
      </div>
    </div>
  )
}

export default App
