import React from 'react'
import { useTranslation } from 'react-i18next'

export default function NoActiveSession() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl px-4 mt-6">
      <div className="card p-6 text-center">
        <p className="text-sm text-slate-600 mb-4">{t('session.noActive')}</p>
        <p className="text-xs text-slate-500">{t('session.quote')}</p>
      </div>
    </div>
  )
}
