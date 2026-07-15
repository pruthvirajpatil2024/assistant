import { useEffect } from 'react'

function requestFullscreen() {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void
  }
  if (document.fullscreenElement) return
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen
  request?.call(el)?.catch?.(() => {
    // Ignore — most mobile browsers require a user gesture; the
    // touchend/click fallback below covers that case.
  })
}

/** Requests fullscreen on load, and again on first touch/click since most
 * mobile browsers block programmatic fullscreen without a user gesture. */
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
}
