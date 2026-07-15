import { useEffect, useState } from 'react'

export type Orientation = 'portrait' | 'landscape'

function getOrientation(): Orientation {
  if (typeof window === 'undefined') return 'landscape'
  return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(getOrientation)

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = () => setOrientation(mq.matches ? 'portrait' : 'landscape')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return orientation
}
