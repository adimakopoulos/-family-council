import React from 'react'

export default function PreSessionOverlay({
  until,
  text,
  onDone
}: {
  until: number
  text: string
  onDone: () => void
}) {
  const [now, setNow] = React.useState(Date.now())

  React.useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= until) {
        clearInterval(id)
        onDone()
      }
    }, 200)
    return () => clearInterval(id)
  }, [until, onDone])

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur">
      <div className="card p-8 text-center">
        <div className="animate-pulse text-lg font-semibold mb-2">{text}</div>
        <div className="text-2xl font-bold">{secondsLeft}s</div>
        <div className="text-xs text-slate-600 mt-1">
          Go to Active Session tab / Μετάβαση στην Ενεργή Συνεδρία
        </div>
      </div>
    </div>
  )
}
