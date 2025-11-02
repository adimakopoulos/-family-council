import React from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { dfLocale, toLocalInput } from '../../utils/dates'
import { Proposal, ServerState, You } from '../../types'
import StatusBadge from '../common/StatusBadge'
import Meta from '../common/Meta'
import { ws } from '../../services/ws'

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
    voteDeadline: toLocalInput(new Date()),
    eventDate: ''
  })

  const create = () => {
    if (!form.title){
      alert('Please fill Title. / Συμπληρώστε Τίτλο.')
      return
    }
    ws.createProposal({
      title: form.title,
      description: form.description ? form.description : '-',
      voteDeadline: form.voteDeadline
        ? new Date(form.voteDeadline).toISOString()
        : new Date().toISOString(),
      eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined,
      author: you.name,
    } as any)

    setForm({ title:'', description:'', voteDeadline: toLocalInput(new Date()), eventDate:'' })
    // optimistic snack
    pushSnack(t('snack.proposalCreated'), 'success')
  }

  const canEdit = (p: Proposal) => you.isAdmin || p.author === you.name

  return (
    <div className="mx-auto max-w-6xl px-4 mt-6 grid md:grid-cols-2 gap-6">
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">{t('forms.newProposal')}</h2>
        <div className="grid gap-3">
          <label className="label">{t('forms.title')}</label>
          <input className="input" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />

          <label className="label">{t('forms.description')}</label>
          <textarea className="input h-24" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />

          <label className="label">{t('forms.voteDeadline')}</label>
          <input
            type="datetime-local"
            className="input input--readonly pr-20"
            value={form.voteDeadline}
            onChange={e=>setForm({...form, voteDeadline:e.target.value})}
            readOnly
            tabIndex={-1}
          />

          <label className="label">{t('forms.eventDateOpt')}</label>
          <input type="datetime-local" className="input" value={form.eventDate} onChange={e=>setForm({...form, eventDate:e.target.value})} />

          <button className="btn-primary mt-2" onClick={create}>{t('actions.create')}</button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">{t('lists.savedProposals')}</h2>
        <div className="space-y-3">
          {state.proposals.length === 0 && <div className="text-slate-500 text-sm">No proposals yet. / Δεν υπάρχουν προτάσεις.</div>}

          {state.proposals.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">{p.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap break-words">{p.description}</p>
                </div>
                <StatusBadge status={p.status as any} />
              </div>

              {/* Meta */}
              <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                <Meta label={t('meta.author')} value={p.author} />
                <Meta label={t('meta.voteBy')} value={format(new Date(p.voteDeadline), 'PPpp', { locale: dfLocale() })} />
                {p.eventDate && <Meta label={t('meta.event')} value={format(new Date(p.eventDate), 'PPpp', { locale: dfLocale() })} />}
                <Meta label={t('meta.status')} value={t(`status.${p.status}` as any)} />
                {p.comments?.length ? <Meta label="Comments / Σχόλια" value={`${p.comments.length}`} /> : null}
                <Meta label="ID" value={p.id} />
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between">
                {canEdit(p) ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-brand-700">{t('actions.edit')}</summary>
                    <div className="mt-2 grid gap-2">
                      <label className="label">Event Date / Ημερομηνία Εκδήλωσης</label>
                      <input
                        type="datetime-local"
                        className="input"
                        defaultValue={p.eventDate ? new Date(p.eventDate).toISOString().slice(0, 16) : ''}
                        onChange={e => ws.editProposal(p.id, { eventDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      />
                      <label className="label">Title / Τίτλος</label>
                      <input className="input" defaultValue={p.title} onBlur={e => ws.editProposal(p.id, { title: e.target.value })} />
                      <label className="label">Description / Περιγραφή</label>
                      <textarea className="input" defaultValue={p.description} onBlur={e => ws.editProposal(p.id, { description: e.target.value })} />
                    </div>
                  </details>
                ) : (
                  <div className="text-xs text-slate-400 italic">No edit rights / Χωρίς δικαιώματα επεξεργασίας</div>
                )}

                {you.isAdmin && (
                  <button
                    className="btn bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      if (confirm('Delete proposal? / Διαγραφή πρότασης;')) ws.deleteProposal(p.id)
                    }}
                  >
                    {t('actions.delete')}
                  </button>
                )}
              </div>

              {/* Author updates */}
              {p.comments?.length ? (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs font-semibold text-slate-600 mb-1">
                    Author updates / Σχόλια–Αλλαγές
                  </div>
                  <ul className="space-y-2">
                    {p.comments
                      .slice()
                      .sort((a,b)=>a.timestamp-b.timestamp)
                      .map((c, idx) => (
                        <li key={idx} className="text-xs text-slate-700 p-2 bg-slate-50 rounded-lg border">
                          <div className="text-[11px] text-slate-500">
                            <span className="font-medium">{c.author}</span> • {new Date(c.timestamp).toLocaleString()}
                          </div>
                          {c.text ? <div className="mt-1 whitespace-pre-wrap break-words">{c.text}</div> : null}
                          {c.eventDate ? (
                            <div className="mt-1">
                              ⇢ Proposed date: <span className="font-medium">
                                {format(new Date(c.eventDate), 'PPpp', { locale: dfLocale() })}
                              </span>
                            </div>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
