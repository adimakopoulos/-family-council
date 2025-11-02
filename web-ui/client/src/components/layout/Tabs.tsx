import React from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

export type TabKey = 'session' | 'proposals' | 'rankings'

export default function Tabs({ tab, setTab }: { tab: TabKey, setTab: (t: TabKey)=>void }) {
  const { t } = useTranslation()
  const items = [
    { key: 'session', label: t('tabs.session') },
    { key: 'proposals', label: t('tabs.proposals') },
    { key: 'rankings', label: t('tabs.rankings') },
  ] as const

  return (
    <div className="mx-auto max-w-6xl px-4 mt-6">
      <div className="flex gap-2">
        {items.map(i => (
          <button
            key={i.key}
            className={clsx(
              'btn px-4 py-2 rounded-xl border',
              tab === i.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            )}
            onClick={() => setTab(i.key)}
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  )
}
