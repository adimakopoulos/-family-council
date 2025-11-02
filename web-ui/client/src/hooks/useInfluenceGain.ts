import * as React from 'react'
import type { ServerState } from '../types'

/**
 * Emits a positive delta only AFTER initial state hydration (to avoid “gained X influence” on hard refresh).
 */
export function useInfluenceGain(
  name: string | null,
  state: ServerState | null,
  hydrated: boolean
) {
  const prev = React.useRef<number | null>(null)
  const initialized = React.useRef(false)
  const [flash, setFlash] = React.useState(false)
  const [delta, setDelta] = React.useState(0)

  const curr = name && state?.users ? (state.users[name]?.influence ?? 0) : 0

  React.useEffect(() => {
    if (!hydrated) return

    if (!initialized.current) {
      initialized.current = true
      prev.current = curr
      setDelta(0)
      return
    }

    const d = curr - (prev.current ?? curr)
    if (d > 0) {
      setDelta(d)
      setFlash(true)
      const id = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(id)
    } else {
      setDelta(0)
    }
    prev.current = curr
  }, [curr, hydrated])

  return { curr, flash, delta }
}
