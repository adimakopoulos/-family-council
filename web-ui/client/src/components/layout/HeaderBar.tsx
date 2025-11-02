import React from 'react'
import { useTranslation } from 'react-i18next'

import XPBar from '../XPBar'                   // ⬅️ one level up
import LangSwitch from './LangSwitch'          // same folder
import { tierProgress } from '../../utils/rankings' // ⬅️ two levels up
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

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{t('app.title')}</h1>
            <p className="text-xs text-slate-500">
              {t('header.live')}: <span className="font-medium">{live.join(', ') || '—'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 min-w-[220px]">
          {you && (
            <div className="text-sm text-slate-600 w-full">
              <div>
                {you.isAdmin ? t('role.admin') : t('role.member')} — {you.name}
              </div>
              <div className="mt-1">
                <XPBar
                  pct={prog.pct * 100}
                  flash={xpFlash}
                  label={`${youInfluence} • ${prog.curr.title}${prog.next ? ` → ${prog.next.title}` : ''}`}
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
