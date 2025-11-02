import React from 'react'
import { ServerState, You } from '../../types'
import XPBar from '../XPBar'
import { influenceScore, tierProgress, INFLUENCE_TIERS, influenceTierIndex } from '../../utils/rankings'
import { ws } from '../../services/ws'
import { useTranslation } from 'react-i18next'

export default function RankingsTab({ state, you }:{
  state: ServerState; you: You
}) {
  const { t } = useTranslation()
  const users = Object.values(state.users || {})
  const sorted = [...users].sort((a,b)=> (influenceScore(b as any) - influenceScore(a as any)))

  return (
    <div className="mx-auto max-w-5xl px-4 mt-6 space-y-6">
      {/* How it works / instructions */}
      <div className="card p-4">
        <h3 className="font-semibold mb-2">{t('rankings.howItWorksTitle')}</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          <li>{t('rankings.howItWorks.vote')}</li>
          <li>{t('rankings.howItWorks.proposals')}</li>
          <li>{t('rankings.howItWorks.tyrant')}</li>
          <li>{t('rankings.howItWorks.behavior')}</li>
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">{t('rankings.boardTitle')}</h2>

          <div className="space-y-3">
            {sorted.map(u => {
              const score = influenceScore(u as any)
              const prog = tierProgress(score)
              const level = influenceTierIndex(score) + 1

              return (
                <div key={u.name} className="border rounded-xl p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm">
                        <span className="font-semibold">{t('rankings.name')}:</span> {u.name}
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">{t('rankings.title')}:</span> {prog.curr.title}
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">{t('rankings.influence')}:</span> {score}
                      </div>
                    </div>

                    {you?.isAdmin ? (
                      <button
                        className="btn bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => {
                          if (confirm(t('rankings.deleteUserConfirm', { name: u.name }))) {
                            ws.deleteUser(u.name)
                          }
                        }}
                      >
                        {t('actions.delete')}
                      </button>
                    ) : null}
                  </div>

                  {/* Progress section */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <div>{t('rankings.levelLabel', { level })}</div>
                      <div>
                        {prog.next
                          ? t('rankings.toPromote', { amount: prog.toNext, title: prog.next.title })
                          : t('rankings.maxTier')}
                      </div>
                    </div>

                    {/* thicker, more traditional progress bar */}
                    <XPBar
                      pct={prog.pct * 100}
                      label={t('rankings.progressPct', { pct: Math.round(prog.pct * 100) })}
                      height={12}         // thicker
                    />
                  </div>
                </div>
              )
            })}

            {sorted.length === 0 && (
              <div className="text-slate-500 text-sm">{t('rankings.noMembers')}</div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">{t('rankings.tiersTitle')}</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {INFLUENCE_TIERS.map((tTier, i) => (
              <li key={i}>
                <span className="font-medium">{tTier.title}</span> — {tTier.description} (≥{tTier.min})
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
