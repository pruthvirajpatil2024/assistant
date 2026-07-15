import { useEffect, useRef } from 'react'

interface QuestionAreaProps {
  text: string
  isLive: boolean
}

export function QuestionArea({ text, isLive }: QuestionAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep the newest words in view, like live captions.
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [text])

  return (
    <div className="question-area" ref={containerRef}>
      <span className="question-text">
        {text || (isLive ? 'Listening…' : '')}
      </span>
    </div>
  )
}
