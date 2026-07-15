import { useEffect, useState } from 'react'

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const uaMobile = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)
  const coarsePointer =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  return uaMobile || coarsePointer
}

/** Best-effort mobile-device detection (user agent + coarse pointer). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(detectMobile)

  useEffect(() => {
    setIsMobile(detectMobile())
  }, [])

  return isMobile
}
