export type ButtonState = 'idle' | 'recording' | 'processing'

interface RecordButtonProps {
  state: ButtonState
  disabled?: boolean
  onPress: () => void
}

export function RecordButton({ state, disabled, onPress }: RecordButtonProps) {
  const label = state === 'recording' ? 'STOP' : state === 'processing' ? '···' : 'START'

  return (
    <button
      type="button"
      className={`record-button ${state}`}
      onClick={onPress}
      disabled={disabled || state === 'processing'}
      aria-label={label}
    >
      {label}
    </button>
  )
}
