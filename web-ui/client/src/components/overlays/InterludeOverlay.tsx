import React from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { celebratePass } from '../../confetti'

type LastOutcome = { id: string; title: string; outcome: 'passed' | 'rejected' } | null

export default function InterludeOverlay({
  until,
  text,
  lastOutcome,
  onDone,
}: {
  until: number
  text: string
  lastOutcome?: LastOutcome
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [now, setNow] = React.useState(Date.now())

  // countdown tick
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

  // confetti for pass once per shown outcome
  const lastOutcomeId = lastOutcome?.id
  React.useEffect(() => {
    if (lastOutcome?.outcome === 'passed') celebratePass()
  }, [lastOutcomeId]) // run once per different outcome id

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur">
      <div className="card p-8 text-center">
        {lastOutcome && (
          <div className="mb-3">
            <div
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm',
                lastOutcome.outcome === 'passed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              )}
            >
              <span>{lastOutcome.outcome === 'passed' ? '✅' : '❌'}</span>
              <span className="font-semibold">
                {lastOutcome.outcome === 'passed' ? t('status.passed') : t('status.rejected')}
              </span>
            </div>
            <div className="mt-2 text-base font-medium">{lastOutcome.title}</div>
          </div>
        )}

        <div className="animate-pulse text-sm text-slate-600 mb-1">
          {t('overlays.interlude')}
        </div>
        <div className="text-2xl font-bold">{secondsLeft}s</div>
      </div>
    </div>
  )
}
