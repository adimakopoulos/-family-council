// src/components/Snackbar.tsx
import React from 'react'
import clsx from 'clsx'

export type SnackTone = 'info' | 'success' | 'warning' | 'error'
export type Snack = { id: string; text: string; tone?: SnackTone }

export function useSnackQueue() {
  const [snacks, setSnacks] = React.useState<Snack[]>([])

  const remove = React.useCallback((id: string) => {
    setSnacks(s => s.filter(x => x.id !== id))
  }, [])

  const push = React.useCallback((text: string, tone: SnackTone = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setSnacks(s => [...s, { id, text, tone }])
    // auto-dismiss after 2.5s
    setTimeout(() => remove(id), 2500)
  }, [remove])

  return { snacks, push, remove }
}

export function SnackStack({ snacks, onClose }: { snacks: Snack[]; onClose: (id: string)=>void }) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,560px)] space-y-2">
      {snacks.map(s => (
        <div
          key={s.id}
          className={clsx(
            'rounded-xl border px-4 py-3 shadow-sm flex items-start gap-3',
            s.tone === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
            s.tone === 'warning' && 'bg-amber-50 border-amber-200 text-amber-800',
            s.tone === 'error' && 'bg-rose-50 border-rose-200 text-rose-800',
            (!s.tone || s.tone === 'info') && 'bg-slate-50 border-slate-200 text-slate-800'
          )}
        >
          <div className="text-lg leading-none">
            {s.tone === 'success' ? '✅' : s.tone === 'warning' ? '⚠️' : s.tone === 'error' ? '❌' : 'ℹ️'}
          </div>
          <div className="text-sm">{s.text}</div>
          <button
            className="ml-auto text-slate-400 hover:text-slate-600"
            onClick={()=>onClose(s.id)}
            aria-label="close"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
