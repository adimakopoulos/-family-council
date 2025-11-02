import React from 'react'
import { useTranslation } from 'react-i18next'
import { ws } from '../services/ws'
import type { ServerState } from '../types'

export default function AdminSettingsCard({ settings }: { settings: ServerState['settings'] }) {
  const { t } = useTranslation()
  return (
    <details className="ml-auto card p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {t('admin.settings')}
      </summary>

      <div className="grid grid-cols-2 gap-2 mt-2 items-center">
        <label className="label" htmlFor="req">{t('admin.required')}</label>
        <input
          id="req"
          type="number"
          className="input"
          defaultValue={settings.requiredMembers}
          onBlur={e => ws.updateSettings({ requiredMembers: Number(e.target.value) })}
        />

        <label className="label" htmlFor="count">{t('admin.countdown')}</label>
        <input
          id="count"
          type="number"
          className="input"
          defaultValue={settings.countdownSeconds}
          onBlur={e => ws.updateSettings({ countdownSeconds: Number(e.target.value) })}
        />

        <label className="label" htmlFor="inter">{t('admin.interlude')}</label>
        <input
          id="inter"
          type="number"
          className="input"
          defaultValue={settings.interludeSeconds}
          onBlur={e => ws.updateSettings({ interludeSeconds: Number(e.target.value) })}
        />

        <label className="label" htmlFor="pre">{t('admin.preSession')}</label>
        <input
          id="pre"
          type="number"
          className="input"
          defaultValue={settings.preSessionSeconds}
          onBlur={e => ws.updateSettings({ preSessionSeconds: Number(e.target.value) })}
        />
      </div>
    </details>
  )
}
