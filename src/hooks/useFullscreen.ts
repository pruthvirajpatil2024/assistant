import { useCallback, useEffect } from 'react'

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function requestFullscreen() {
  if (document.fullscreenElement) return
  const el = document.documentElement as FullscreenElement
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen
  try {
    const result = request?.call(el)
    if (result && typeof (result as Promise<void>).catch === 'function') {
      ;(result as Promise<void>).catch(() => {
        // Most mobile browsers reject this without a direct user gesture —
        // the button-press call site is the reliable path.
      })
    }
  } catch {
    // Some browsers throw synchronously instead of rejecting.
  }
}

/** Requests fullscreen on load (best-effort — usually blocked without a
 * gesture) and on the first touch/click anywhere as a fallback. Also
 * returns a `request` function to call directly from a button press,
 * which is the path mobile browsers actually honor. */
export function useFullscreen() {
  useEffect(() => {
    requestFullscreen()

    const onFirstInteraction = () => requestFullscreen()
    document.addEventListener('touchend', onFirstInteraction, { once: true })
    document.addEventListener('click', onFirstInteraction, { once: true })

    return () => {
      document.removeEventListener('touchend', onFirstInteraction)
      document.removeEventListener('click', onFirstInteraction)
    }
  }, [])

  return useCallback(() => requestFullscreen(), [])
}
