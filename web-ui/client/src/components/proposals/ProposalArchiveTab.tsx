import React from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { dfLocale } from '../../utils/dates'
import { Proposal, ServerState, You } from '../../types'
import StatusBadge from '../common/StatusBadge'
import { ws } from '../../services/ws'
import {
  isArchived,
  canEditArchive,
  canDeleteArchive,
} from '../../utils/permissions'

export default function ProposalArchiveTab({
  state, you
}:{
  state: ServerState
  you: You
}) {
  const { t } = useTranslation()
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState<string>('all')
  const [author, setAuthor] = React.useState<string>('all')
  const [from, setFrom] = React.useState<string>('') // YYYY-MM-DD
  const [to, setTo] = React.useState<string>('')     // YYYY-MM-DD

  const archived = (state.proposals || []).filter(isArchived)

  const authors = React.useMemo(() => {
    const set = new Set(archived.map(p => p.author))
    return ['all', ...Array.from(set)]
  }, [archived])

  const filtered = archived.filter(p => {
    if (q && !(`${p.title} ${p.description || ''}`.toLowerCase().includes(q.toLowerCase()))) return false
    if (status !== 'all' && p.status !== status) return false
    if (author !== 'all' && p.author !== author) return false
    if (from) {
      const fromMs = new Date(from + 'T00:00:00').getTime()
      const voteMs = new Date(p.voteDeadline).getTime()
      if (voteMs < fromMs) return false
    }
    if (to) {
      const toMs = new Date(to + 'T23:59:59').getTime()
      const voteMs = new Date(p.voteDeadline).getTime()
      if (voteMs > toMs) return false
    }
    return true
  })

  return (
    <div className="mx-auto max-w-6xl px-4 mt-6">
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">{t('archive.title')}</h2>

        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-2 mb-4">
          <input
            className="input"
            placeholder={t('archive.searchPlaceholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">{t('archive.status.all')}</option>
            <option value="passed">{t('status.passed')}</option>
            <option value="rejected">{t('status.rejected')}</option>
            <option value="closed">{t('status.closed') /* if you have it */}</option>
          </select>
          <select className="input" value={author} onChange={e => setAuthor(e.target.value)}>
            {authors.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex gap-2">
            <input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
            <input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)} />
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-slate-500 text-sm">{t('archive.empty')}</div>
          )}

          {filtered.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">{p.title}</h3>
                  {p.description ? (
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap break-words">{p.description}</p>
                  ) : null}
                </div>
                <StatusBadge status={p.status as any} />
              </div>

              {/* Meta (compact) */}
              <div className="mt-2 text-xs text-slate-600">
                {t('meta.author')}: <span className="font-medium">{p.author}</span> • {t('meta.voteBy')}:{' '}
                <span className="font-medium">{format(new Date(p.voteDeadline), 'PPpp', { locale: dfLocale() })}</span>
                {p.eventDate ? (
                  <>
                    {' '}• {t('meta.event')}: <span className="font-medium">
                      {format(new Date(p.eventDate), 'PPpp', { locale: dfLocale() })}
                    </span>
                  </>
                ) : null}
              </div>

              {/* Actions (admin/alex only on archive) */}
              <div className="mt-3 flex items-center justify-end gap-3">
                {canEditArchive(p, you) && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
