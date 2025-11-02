import React from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { dfLocale } from '../../utils/dates'
import { Proposal, ServerState, You } from '../../types'
import StatusBadge from '../common/StatusBadge'
import Meta from '../common/Meta'

type StatusOpt = 'all' | 'open' | 'passed' | 'rejected' | 'pending'

export default function ProposalArchiveTab({
  state, you
}:{
  state: ServerState
  you: You
}) {
  const { t } = useTranslation()

  const authors = React.useMemo(() => {
    const set = new Set<string>()
    for (const p of state.proposals || []) set.add(p.author)
    return Array.from(set).sort((a,b)=>a.localeCompare(b))
  }, [state.proposals])

  const [filters, setFilters] = React.useState<{
    status: StatusOpt
    author: string
    from: string   // yyyy-MM-dd
    to: string     // yyyy-MM-dd
  }>({ status: 'all', author: '', from: '', to: '' })

  const filtered = React.useMemo(() => {
    const list = (state.proposals || []).slice().sort((a,b) =>
      new Date(b.voteDeadline).getTime() - new Date(a.voteDeadline).getTime()
    )
    return list.filter(p => {
      // status: treat "pending" as "open" if you use that
      if (filters.status !== 'all') {
        const s = p.status === 'pending' ? 'pending' : p.status
        if (s !== filters.status) return false
      }
      if (filters.author && p.author !== filters.author) return false

      // date filtering on "creation date" (we store it in voteDeadline)
      const d = new Date(p.voteDeadline)
      if (filters.from) {
        const from = new Date(filters.from + 'T00:00:00')
        if (d < from) return false
      }
      if (filters.to) {
        const to = new Date(filters.to + 'T23:59:59')
        if (d > to) return false
      }
      return true
    })
  }, [state.proposals, filters])

  return (
    <div className="mx-auto max-w-6xl px-4 mt-6">
      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="grid md:grid-cols-4 gap-3">
          {/* Status */}
          <div>
            <label className="label">{t('archive.status')}</label>
            <select
              className="input"
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value as StatusOpt })}
            >
              <option value="all">{t('archive.any')}</option>
              <option value="open">{t('status.open')}</option>
              <option value="passed">{t('status.passed')}</option>
              <option value="rejected">{t('status.rejected')}</option>
              {/* include pending if your server sends that value */}
              <option value="pending">{t('status.pending', { defaultValue: 'Pending' })}</option>
            </select>
          </div>

          {/* Author */}
          <div>
            <label className="label">{t('archive.author')}</label>
            <select
              className="input"
              value={filters.author}
              onChange={e => setFilters({ ...filters, author: e.target.value })}
            >
              <option value="">{t('archive.any')}</option>
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* From */}
          <div>
            <label className="label">{t('archive.fromDate')}</label>
            <input
              type="date"
              className="input"
              value={filters.from}
              onChange={e => setFilters({ ...filters, from: e.target.value })}
            />
          </div>

          {/* To */}
          <div>
            <label className="label">{t('archive.toDate')}</label>
            <input
              type="date"
              className="input"
              value={filters.to}
              onChange={e => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-slate-500 text-sm">{t('archive.noResults')}</div>
        )}

        {filtered.map(p => (
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

            <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1">
              <Meta label={t('meta.author')} value={p.author} />
              {/* creation date (stored in voteDeadline) */}
              <Meta label={t('meta.creationDate')} value={format(new Date(p.voteDeadline), 'PPpp', { locale: dfLocale() })} />
              {p.eventDate && <Meta label={t('meta.event')} value={format(new Date(p.eventDate), 'PPpp', { locale: dfLocale() })} />}
              <Meta label={t('meta.status')} value={t(`status.${p.status}` as any)} />
              <Meta label="ID" value={p.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
