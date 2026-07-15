import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFullscreen } from './hooks/useFullscreen'
import { useOrientation } from './hooks/useOrientation'
import { useIsMobile } from './hooks/useIsMobile'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { RotatePrompt } from './components/RotatePrompt'
import { RecordButton, type ButtonState } from './components/RecordButton'
import { QuestionArea } from './components/QuestionArea'
import { AnswerDisplay } from './components/AnswerDisplay'
import './App.css'

type Phase = 'idle' | 'recording' | 'processing' | 'answered'

function App() {
  const requestFullscreen = useFullscreen()
  const orientation = useOrientation()
  const isMobile = useIsMobile()
  const { transcript, isSupported, start, stop } = useSpeechRecognition()

  const [phase, setPhase] = useState<Phase>('idle')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [sessionId, setSessionId] = useState(0)

  const beginRecording = useCallback(() => {
    setQuestion('')
    setAnswer('')
    setError('')
    setSessionId((id) => id + 1)
    setPhase('recording')
    start()
  }, [start])

  const finishRecording = useCallback(async () => {
    const finalTranscript = await stop()
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
  }, [stop])

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
    phase === 'processing' ? 'processing' : phase === 'recording' ? 'recording' : 'idle'
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
