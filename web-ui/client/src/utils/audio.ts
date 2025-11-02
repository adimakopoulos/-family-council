// Centralized audio (so App stays lean)
const FILE_SOUNDS: Record<'pass'|'reject'|'start'|'gavel'|'xp', string> = {
  pass:  '/sounds/pass.wav',
  reject:'/sounds/reject.wav',
  start: '/sounds/start.wav',
  gavel: '/sounds/gavel.wav',
  xp:    '/sounds/xp.wav',
}
const VOLUMES: Record<'pass'|'reject'|'start'|'gavel'|'xp', number> = {
  pass: 0.50, reject: 0.50, start: 0.50, gavel: 0.40, xp: 0.35,
}

export async function playSound(kind: keyof typeof FILE_SOUNDS) {
  try {
    const a = new Audio(FILE_SOUNDS[kind])
    a.volume = VOLUMES[kind] ?? 0.3
    await a.play()
  } catch (err) {
    console.warn('Audio play failed:', err)
  }
}
export async function unlockAudio() {
  try {
    const a = new Audio(FILE_SOUNDS.start)
    a.volume = 0
    await a.play().catch(() => {})
    a.pause()
    a.currentTime = 0
  } catch {}
}
