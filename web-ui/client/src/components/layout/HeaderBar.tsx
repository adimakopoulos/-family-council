import React from 'react'
import { useTranslation } from 'react-i18next'
import XPBar from '../XPBar'            // NOTE: from layout/, correct relative path is ../XPBar
import LangSwitch from './LangSwitch'
import { tierProgress, influenceTierIndex } from '../../utils/rankings'
import { You } from '../../types'

export default function HeaderBar({
  live,
  you,
  youInfluence,
  xpFlash
}: {
  live: string[],
  you: You | null,
  youInfluence: number,
  xpFlash: boolean
}) {
  const { t } = useTranslation()
  const prog = tierProgress(youInfluence)
  const level = influenceTierIndex(youInfluence) + 1

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{t('app.title')}</h1>
            <p className="text-xs text-slate-500 truncate">
              {t('header.live')}: <span className="font-medium">{live.join(', ') || '—'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 min-w-[280px]">
          {you && (
            <div className="text-sm text-slate-700 w-full min-w-0">
              {/* One line: Name · Title · Influence */}
              <div className="truncate">
                <span className="font-medium">{t('rankings.name')}:</span> {you.name}
                {' · '}
                <span className="font-medium">{t('rankings.title')}:</span> {prog.curr.title}
                {' · '}
                <span className="font-medium">{t('rankings.influence')}:</span> {youInfluence}
              </div>

              {/* Level + progress */}
              <div className="mt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                  <div>{t('rankings.levelLabel', { level })}</div>
                  <div>
                    {prog.next
                      ? t('rankings.nextUp', { title: prog.next.title })
                      : t('rankings.maxTier')}
                  </div>
                </div>
                <XPBar
                  pct={prog.pct * 100}
                  flash={xpFlash}
                  label={t('rankings.progressPct', { pct: Math.round(prog.pct * 100) })}
                  height={12}  // thicker
                />
              </div>
            </div>
          )}

          <LangSwitch />
        </div>
      </div>
    </div>
  )
}
