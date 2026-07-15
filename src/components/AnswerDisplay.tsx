interface AnswerDisplayProps {
  answer: string
}

interface Segment {
  type: 'text' | 'code'
  content: string
}

function parseAnswer(raw: string): Segment[] {
  const lines = raw.split('\n')
  const segments: Segment[] = []
  let inCode = false
  let buffer: string[] = []

  const flush = (type: Segment['type']) => {
    const content = buffer.join('\n').trim()
    if (content) segments.push({ type, content })
    buffer = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flush(inCode ? 'code' : 'text')
      inCode = !inCode
      continue
    }
    buffer.push(line)
  }
  flush(inCode ? 'code' : 'text')
  return segments
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function AnswerDisplay({ answer }: AnswerDisplayProps) {
  const segments = parseAnswer(answer)

  return (
    <div className="answer-display">
      {segments.map((segment, i) =>
        segment.type === 'code' ? (
          <pre key={i} className="answer-code">
            <code>{segment.content}</code>
          </pre>
        ) : (
          segment.content.split('\n').map((line, j) => (
            <p key={`${i}-${j}`} className="answer-line">
              {renderInline(line)}
            </p>
          ))
        ),
      )}
    </div>
  )
}
