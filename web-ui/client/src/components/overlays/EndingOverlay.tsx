import React from 'react'
import { useTranslation } from 'react-i18next'

type EndingItem = {
  id: string
  title: string
  outcome: 'passed' | 'rejected'
  rounds: number
  totalVotingMs: number
  acceptCount: number
  rejectCount: number
}

type EndingSummary = {
  total: number
  passed: number
  rejected: number
  totalMs: number
  avgMs: number
  items: EndingItem[]
  fastest?: EndingItem | null
  slowest?: EndingItem | null
}

export default function EndingOverlay({
  summary,
  onClose,
  playEndSound
}: {
  summary: EndingSummary
  onClose: () => void
  /** Optional: play a sound as soon as the overlay mounts */
  playEndSound?: () => void
}) {
  const { t } = useTranslation()

  React.useEffect(() => {
    playEndSound?.()
  }, [playEndSound])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur">
      <div className="card p-6 max-w-3xl w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">Session Summary / Σύνοψη Συνεδρίας</h3>
          <button className="btn btn-secondary" onClick={onClose}>Close / Κλείσιμο</button>
        </div>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="card p-3">
            <div className="text-xs text-slate-500">{t('overlays.proposalsVoted')}</div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">{t('overlays.passed')}</div>
            <div className="text-2xl font-bold">{summary.passed}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">{t('overlays.rejected')}</div>
            <div className="text-2xl font-bold">{summary.rejected}</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-600">
          {t('overlays.avgTime')}: {Math.round((summary.avgMs || 0) / 1000)}s • {t('overlays.totalTime')}: {Math.round((summary.totalMs || 0) / 1000)}s
        </div>

        {(summary.fastest || summary.slowest) && (
          <div className="mt-2 grid md:grid-cols-2 gap-3 text-sm">
            {summary.fastest && (
              <div className="card p-3">
                Fastest / Ταχύτερη: <span className="font-medium">{summary.fastest.title}</span> — {Math.round(summary.fastest.totalVotingMs / 1000)}s, rounds {summary.fastest.rounds}
              </div>
            )}
            {summary.slowest && (
              <div className="card p-3">
                Slowest / Πιο Αργή: <span className="font-medium">{summary.slowest.title}</span> — {Math.round(summary.slowest.totalVotingMs / 1000)}s, rounds {summary.slowest.rounds}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th>Title / Τίτλος</th>
                <th>Outcome / Έκβαση</th>
                <th>Rounds / Γύροι</th>
                <th>Time / Χρόνος</th>
                <th>Accept/Reject</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="py-1">{it.title}</td>
                  <td>{it.outcome}</td>
                  <td>{it.rounds}</td>
                  <td>{Math.round((it.totalVotingMs || 0) / 1000)}s</td>
                  <td>{it.acceptCount}/{it.rejectCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Tip: Author comments reset the timer and add a round. / Τα σχόλια του συγγραφέα επανεκκινούν τον χρόνο και προσθέτουν γύρο.
        </div>
      </div>
    </div>
  )
}
