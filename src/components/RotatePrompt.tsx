interface RotatePromptProps {
  reason: 'orientation' | 'device'
}

export function RotatePrompt({ reason }: RotatePromptProps) {
  if (reason === 'device') {
    return (
      <div className="rotate-prompt">
        <h1>Mobile device required</h1>
        <p>Open this on a phone in landscape mode.</p>
      </div>
    )
  }

  return (
    <div className="rotate-prompt">
      <h1>Rotate your phone</h1>
      <p>Landscape mode required.</p>
    </div>
  )
}
