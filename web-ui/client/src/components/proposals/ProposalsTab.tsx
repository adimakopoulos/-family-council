import React from 'react'
import { useTranslation } from 'react-i18next'
import { ws } from '../../services/ws'
import { toLocalInput } from '../../utils/dates'
import { Proposal, ServerState, You } from '../../types'
import StatusBadge from '../common/StatusBadge'

export default function ProposalsTab({
  state, you, pushSnack
}:{
  state: ServerState
  you: You
  pushSnack: (text: string, tone?: any)=>void
}) {
  const { t } = useTranslation()
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    voteDeadline: toLocalInput(new Date()), // acts as "creation date" (locked)
    eventDate: ''
  })

  const create = () => {
    if (!form.title) {
      alert(t('forms.titleMissingAlert'))
      return
    }
    ws.createProposal({
      title: form.title,
      description: form.description || '-',
      voteDeadline: new Date(form.voteDeadline).toISOString(),
      eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined,
      author: you.name,
    } as any)

    setForm({ title:'', description:'', voteDeadline: toLocalInput(new Date()), eventDate:'' })
    pushSnack(t('snack.proposalCreated'), 'success')
  }

  // Helpers (inline permissions)
  const isPendingOrOpen = (p: Proposal) => p.status === 'pending' || p.status === 'open'
  const canEditOrDelete = (p: Proposal) => isPendingOrOpen(p) && p.author === you.name

  // Only show proposals authored by the current user that are still pending/open.
  const yourPending = (state.proposals || []).filter(p =>
    p.author === you.name && isPendingOrOpen(p)
  )

  return (
    <div className="mx-auto max-w-6xl px-4 mt-6 grid md:grid-cols-2 gap-6">
      {/* Create new */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">{t('forms.newProposal')}</h2>

        <div className="grid gap-3">
          {/* Title (required) */}
          <label className="label">{t('forms.title')}</label>
          <input
            className="input"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder={t('forms.titlePlaceholder')}
          />

          {/* Event date (optional) */}
          <label className="label">{t('forms.eventDateOpt')}</label>
          <input
            type="datetime-local"
            className="input"
            value={form.eventDate}
            onChange={e => setForm({ ...form, eventDate: e.target.value })}
            placeholder={t('forms.eventDatePlaceholder')}
            aria-label={t('forms.eventDatePlaceholder')}
            title={t('forms.eventDatePlaceholder')}
          />

          {/* Description (optional) */}
          <label className="label">{t('forms.description')}</label>
          <textarea
            className="input h-24"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder={t('forms.descriptionPlaceholder')}
          />

          {/* Separator */}
          <div className="my-4 h-px bg-slate-200" role="separator" aria-hidden />

          {/* Read-only / locked */}
          <label className="label">{t('forms.creationDateLocked')}</label>
          <input
            type="datetime-local"
            className="input input--readonly pr-20"
            value={form.voteDeadline}
            readOnly
            tabIndex={-1}
          />

          <label className="label">{t('forms.authorLocked')}</label>
          <input
            className="input input--readonly"
            value={you.name}
            readOnly
            tabIndex={-1}
          />

          <button className="btn-primary mt-2" onClick={create}>
            {t('actions.create')}
          </button>
        </div>
      </div>

      {/* Your pending proposals */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">{t('lists.yourPending')}</h2>
        <div className="space-y-3">
          {yourPending.length === 0 && (
            <div className="text-slate-500 text-sm">{t('lists.noPending')}</div>
          )}

          {yourPending.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">{p.title}</h3>
                  {p.description ? (
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap break-words">
                      {p.description}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={p.status as any} />
              </div>

              {/* Author-only actions for pending/open */}
              {canEditOrDelete(p) && (
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const nextTitle = prompt(t('forms.editTitlePrompt'), p.title)
                      if (nextTitle != null) ws.editProposal(p.id, { title: nextTitle })
                    }}
                  >
                    {t('actions.edit')}
                  </button>
                  <button
                    className="btn bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      if (confirm(t('actions.deleteConfirm'))) ws.deleteProposal(p.id)
                    }}
                  >
                    {t('actions.delete')}
                  </button>
                </div>
              )}

              {/* Context hint */}
              <div className="mt-2 text-xs text-slate-500">
                {t('lists.pendingHint')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
