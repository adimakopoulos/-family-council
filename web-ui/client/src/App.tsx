import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useSnackQueue, SnackStack } from './components/Snackbar'
import { ws } from './services/ws'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { Proposal, VoteChoice, ServerState, You } from './types'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import i18n from './i18n'
import { enUS, el as elLocale } from 'date-fns/locale'
import { celebratePass } from './confetti'
import XPBar from './components/XPBar'
import { tierProgress, influenceScore, INFLUENCE_TIERS, influenceTierIndex } from './utils/rankings'
export function dfLocale() {
  return i18n.language.startsWith('el') ? elLocale : enUS
}

type TabKey =   'session' | 'proposals'| 'rankings'


// Prefer real files in /public/sounds; fall back to embedded beeps if loading fails.
const FILE_SOUNDS: Record<'pass'|'reject'|'start'|'gavel'|'xp', string> = {
  pass:  '/sounds/pass.wav',
  reject:'/sounds/reject.wav',
  start: '/sounds/start.wav',
  gavel: '/sounds/gavel.wav',
  xp:    '/sounds/xp.wav',
};

const TYRANT_COST = 20


const VOLUMES: Record<'pass'|'reject'|'start'|'gavel'|'xp', number> = {
  pass: 0.50,
  reject: 0.50,
  start: 0.50,
  gavel: 0.40,
  xp: 0.35,
};
// function useInfluenceDelta(
//   name: string | null,
//   state: ServerState | null,
//   onGain: (delta: number) => void
// ) {
//   const prev = React.useRef<number | null>(null)
//   const curr = name && state?.users ? (state.users[name]?.influence ?? 0) : 0
//
//   React.useEffect(() => {
//     if (prev.current == null) { prev.current = curr; return }
//     const delta = curr - (prev.current ?? 0)
//     if (delta > 0) {
//       onGain(delta)
//       playSound('xp').catch(()=>{})
//     }
//     prev.current = curr
//   }, [curr, onGain])
//
//   return curr
// }

async function playSound(kind: 'pass'|'reject'|'start'|'gavel'|'xp') {
  try {
    const a = new Audio(FILE_SOUNDS[kind]);
    a.volume = VOLUMES[kind] ?? 0.3
    await a.play();
  } catch (err) {
    // Autoplay blocked or file missing. Check Network tab and browser gesture.
    console.warn('Audio play failed:', err);
  }
}

function useInfluenceGain(
  name: string | null,
  state: ServerState | null,
  hydrated: boolean
) {
  const prev = React.useRef<number | null>(null)
  const initialized = React.useRef(false)
  const [flash, setFlash] = React.useState(false)
  const [delta, setDelta] = React.useState(0)

  const curr = name && state?.users ? (state.users[name]?.influence ?? 0) : 0

  useEffect(() => {
    if (!hydrated) return

    // First pass after hydration: baseline to current, do not emit delta
    if (!initialized.current) {
      initialized.current = true
      prev.current = curr
      setDelta(0)
      return
    }

    const d = curr - (prev.current ?? curr)
    if (d > 0) {
      setDelta(d)
      setFlash(true)
      const id = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(id)
    } else {
      setDelta(0)
    }
    prev.current = curr
  }, [curr, hydrated])

  return { curr, flash, delta }
}




function StatusBadge({ status }: { status: Proposal['status'] }) {
  const { t } = useTranslation();             // <-- add this
  const styles: Record<string, string> = {
    open: 'bg-amber-50 text-amber-700 border-amber-200',
    passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const icon: Record<string, string> = { open: '🟡', passed: '✅', rejected: '❌' };

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${styles[status] || ''}`}>
      <span>{icon[status] || '•'}</span>
      <span className="font-medium">{t(`status.${status}`)}</span>
    </span>
  );
}


function Meta({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xs text-slate-700 font-medium truncate">{value}</span>
    </div>
  )
}


function toLocalInput(dt: Date) {
  const z = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0,16) // "YYYY-MM-DDTHH:mm"
}

function useLocalName() {
  const [name, setName] = useState<string>(() => localStorage.getItem('council:name') || '')
  useEffect(() => {
    if (name) localStorage.setItem('council:name', name)
  }, [name])
  return { name, setName }
}
function LangSwitch() {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('el') ? 'el' : 'en'
  return (
    <div className="flex gap-2">
      <button
        className={`btn px-3 py-1 rounded ${lang==='en' ? 'bg-slate-900 text-white' : 'bg-white border'}`}
        onClick={()=>i18n.changeLanguage('en')}
      >EN</button>
      <button
        className={`btn px-3 py-1 rounded ${lang==='el' ? 'bg-slate-900 text-white' : 'bg-white border'}`}
        onClick={()=>i18n.changeLanguage('el')}
      >EL</button>
    </div>
  )
}

function Header({
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



function Tabs({ tab, setTab }: { tab: TabKey, setTab: (t: TabKey)=>void }) {

  const { t } = useTranslation()
  const items = [
    { key: 'session', label: t('tabs.session') },
    { key: 'proposals', label: t('tabs.proposals') },
    { key: 'rankings', label: t('tabs.rankings') }
  ] as const
  return (
    <div className="mx-auto max-w-6xl px-4 mt-6">
      <div className="flex gap-2">
        {items.map(i => (
          <button key={i.key}
            className={clsx('btn px-4 py-2 rounded-xl border',
              tab === i.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100')}
            onClick={() => setTab(i.key)}>{i.label}</button>
        ))}
      </div>
    </div>
  )
}


function ProposalsTab({ state, you, pushSnack }:{
  state: ServerState, you: You, pushSnack: (text: string, tone?: any)=>void
}) {  const { t } = useTranslation()
  const [form, setForm] = useState({
      title: '',
      description: '',
      voteDeadline: toLocalInput(new Date()),   // ← auto-filled on render
      eventDate: ''
  })

  const create = () => {
    if (!form.title){
      return alert('Please fill Title. / Συμπληρώστε Τίτλο.')
    }
    ws.createProposal({
      title: form.title,
      description: form.description ? form.description : '-',
      voteDeadline: form.voteDeadline
            ? new Date(form.voteDeadline).toISOString()
            : new Date().toISOString(),                     // ← fallback to now
      eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined,
      author: you.name,
    } as any)
    setForm({ title:'',
        description:'',
        voteDeadline: toLocalInput(new Date()),
        eventDate:''
        })
    // Snackbar (optimistic)
    pushSnack(t('snack.proposalCreated'), 'success')

    setForm({ title:'', description:'', voteDeadline: toLocalInput(new Date()), eventDate:'' })
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
              {/* Header: title + status */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">{p.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap break-words">{p.description}</p>
                </div>
                <StatusBadge status={p.status as any} />
              </div>

              {/* Meta grid */}
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

              {/* Comments */}
              {/* Author updates / comments */}
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

function RankingsTab({ state, you }:{ state: ServerState; you: You }) {
  const users = Object.values(state.users || {})
  const sorted = [...users].sort((a,b)=> (influenceScore(b as any) - influenceScore(a as any)))
  return (
    <div className="mx-auto max-w-5xl px-4 mt-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Influence Board / Πίνακας Επιρροής</h2>
          <div className="space-y-3">
            {sorted.map(u => {
              const score = influenceScore(u as any)
              const prog = tierProgress(score)

              return (
                <div key={u.name} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{u.name}</div>
                    {you?.isAdmin ? (
                      <button
                        className="btn bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => {
                          if (confirm(`Delete user "${u.name}"? / Διαγραφή χρήστη "${u.name}";`)) {
                            ws.deleteUser(u.name)
                          }
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                    <div><span className="font-medium">{score}</span> influence — {prog.curr.title}</div>
                    <div>{prog.next ? `${prog.toNext} to ${prog.next.title}` : 'Max tier'}</div>
                  </div>

                  <div className="mt-2">
                    <XPBar pct={prog.pct * 100} />
                  </div>
                </div>
              )
            })}
            {sorted.length === 0 && <div className="text-slate-500 text-sm">No members yet. / Δεν υπάρχουν μέλη ακόμα.</div>}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Tiers / Βαθμίδες</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {INFLUENCE_TIERS.map((t, i) => (
              <li key={i}><span className="font-medium">{t.title}</span> — {t.description} (≥{t.min})</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}



function NoActiveSession() {
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

function ActiveSessionView({
  state, you, session, canUseTyrant, yourInfluence, pushSnack
}: {
  state: ServerState
  you: You
  session: NonNullable<ServerState['session']>
  canUseTyrant: boolean
  yourInfluence: number
  pushSnack: (text: string, tone?: any)=>void
}) {
  const { t } = useTranslation()

  // ---- Hooks that used to live in SessionTab (now ALWAYS mounted only in this component)
  const [now, setNow] = React.useState(Date.now())
  const [comment, setComment] = React.useState('')
  const [newEventDate, setNewEventDate] = React.useState('')

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  React.useEffect(() => {
    setComment('')
    setNewEventDate('')
  }, [session?.proposalId])

  // ---- Safe derivations
  const proposal = state.proposals.find(p => p.id === session.proposalId)
  const yourVote: VoteChoice | null =
    (session.votes && (session.votes as Record<string, VoteChoice>)[you.name]) || null

  const deadline = (session.startedAt || 0) + (session.durationSeconds || 0) * 1000
  const remaining = Math.max(0, Math.floor((deadline - now) / 1000))

  const attendees: string[] = session.attendees ?? []
  const votesMap: Record<string, VoteChoice> = session.votes ?? {}
  const votingSet: string[] = (session as any).votingSet ?? attendees
  const cast = votingSet.reduce((n, name) => n + (votesMap[name] ? 1 : 0), 0)
  const total = votingSet.length
  const lateJoiners = attendees.filter(n => !votingSet.includes(n))

  const canAuthorAdjust = proposal && proposal.author === you.name
  const needAdjust = Boolean(session?.awaitingAuthorAdjust)

  const castVote = (choice: VoteChoice) => ws.vote(choice)

  return (
    <div className="mx-auto max-w-4xl px-4 mt-6">
      <div className="card p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-slate-500">
              {t('session.voting') || 'Voting'}
            </div>

            <h3 className="mt-1 text-xl font-bold text-slate-900">{proposal?.title}</h3>
            {proposal?.description ? (
              <div className="mt-2 p-3 rounded-lg bg-slate-50 border text-sm text-slate-700 whitespace-pre-wrap break-words">
                {proposal.description}
              </div>
            ) : null}

            {/* Votes (required voters only) */}
            <div className="mt-3 text-sm">
              <span className="text-slate-600">{t('session.votesCast') || 'Votes cast'}:</span>{' '}
              <span className="font-semibold">{cast}/{total}</span>
              {lateJoiners.length > 0 && (
                <span className="ml-2 text-xs text-slate-500">
                  (+{lateJoiners.length} joined late; counted next round)
                </span>
              )}
            </div>
          </div>

          {/* Time left */}
          <div className="shrink-0 text-right">
            <div className="text-xs text-slate-500">{t('session.timeLeft') || 'Time left'}</div>
            <div className={clsx(
              'text-2xl font-extrabold tracking-tight',
              remaining <= 10 ? 'text-rose-600' : 'text-slate-900'
            )}>
              {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button
            className={clsx(
              'px-6 py-3 rounded-xl border font-semibold transition w-36',
              'bg-white text-slate-800 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300',
              yourVote === 'accept' && 'ring-2 ring-emerald-400'
            )}
            onClick={() => castVote('accept')}
          >
            {t('actions.accept') || 'Accept'}
          </button>

          <button
            className={clsx(
              'px-6 py-3 rounded-xl border font-semibold transition w-36',
              'bg-white text-slate-800 border-slate-300 hover:bg-rose-50 hover:border-rose-300',
              yourVote === 'reject' && 'ring-2 ring-rose-400'
            )}
            onClick={() => castVote('reject')}
          >
            {t('actions.reject') || 'Reject'}
          </button>

          <div className="text-sm text-slate-600 ml-2">
            {t('session.yourVote') || 'Your vote'}:{' '}
            <span className={clsx(
              'font-semibold',
              yourVote === 'accept' && 'text-emerald-700',
              yourVote === 'reject' && 'text-rose-700'
            )}>
              {yourVote || '—'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              className={clsx(
                'btn text-white',
                canUseTyrant ? 'bg-amber-600 hover:bg-amber-700' : 'bg-amber-300 cursor-not-allowed opacity-60'
              )}
              disabled={!canUseTyrant}
              onClick={() => {
                if (!canUseTyrant) {
                  pushSnack(t('snack.notEnough'), 'warning')
                  return
                }
                ws.tyrant('enforce')
                // If you don't already show a “lost influence” snack via your influence-delta hook:
                pushSnack(t('snack.tyrantLost', { amount: TYRANT_COST }), 'warning')
              }}
            >
              {t('actions.tyrantEnforce') || 'Tyrant: Enforce'}
            </button>

            <button
              className={clsx(
                'btn text-white',
                canUseTyrant ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-300 cursor-not-allowed opacity-60'
              )}
              disabled={!canUseTyrant}
              onClick={() => {
                if (!canUseTyrant) {
                  pushSnack(t('snack.notEnough'), 'warning')
                  return
                }
                ws.tyrant('veto')
                // If you don't already show a “lost influence” snack via your influence-delta hook:
                pushSnack(t('snack.tyrantLost', { amount: TYRANT_COST }), 'warning')
              }}
            >
              {t('actions.tyrantVeto') || 'Tyrant: Veto'}
            </button>
          </div>

        </div>

        {/* Author updates visible to everyone */}
        {proposal?.comments?.length ? (
          <div className="mt-5 border-t pt-4">
            <div className="text-sm font-semibold mb-2">
              Author updates / Σχόλια–Αλλαγές
            </div>
            <ul className="space-y-2 text-sm">
              {proposal.comments
                .slice()
                .sort((a,b)=>a.timestamp-b.timestamp)
                .map((c, idx) => (
                  <li key={idx} className="p-2 rounded-lg bg-slate-50 border">
                    <div className="text-xs text-slate-500">
                      {c.author} • {new Date(c.timestamp).toLocaleString()}
                    </div>
                    {c.text ? <div className="mt-1">{c.text}</div> : null}
                    {c.eventDate ? (
                      <div className="mt-1 text-slate-700 text-xs">
                        Proposed new date:{' '}
                        <span className="font-medium">
                          {format(new Date(c.eventDate), 'PPpp', { locale: dfLocale() })}
                        </span>
                      </div>
                    ) : null}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {/* Author adjust */}
        {canAuthorAdjust && needAdjust && (
          <div className="mt-5 border-t pt-4">
            <div className="text-sm font-medium mb-2">
              Not unanimous? Add comment & adjust event date / Μη ομόφωνο; Σχόλιο & αλλαγή ημερομηνίας
            </div>
            <textarea
              className="input h-20"
              placeholder="Comment / Σχόλιο"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <input
                type="datetime-local"
                className="input"
                value={newEventDate}
                onChange={e => setNewEventDate(e.target.value)}
              />
              <button
                className="btn-secondary"
                onClick={() => ws.authorAdjust(session.proposalId, comment, newEventDate || null)}
              >
                Submit / Υποβολή
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
function SessionTab({state, you, pushSnack}:{
  state: ServerState, you: You, pushSnack: (text: string, tone?: any)=>void, yourInfluence: number
}) {
  const { t } = useTranslation()
  const session = state.session
  const yourInfluence =
    (state.users && state.users[you.name]?.influence) != null
      ? state.users[you.name]!.influence
      : 0
  const canUseTyrant = (yourInfluence || 0) >= TYRANT_COST
  // IMPORTANT: no hooks after a conditional return here.
  if (!session || session.status !== 'active') {
    return <NoActiveSession />
  }
  return <ActiveSessionView state={state} you={you} session={session} canUseTyrant={canUseTyrant} yourInfluence={yourInfluence} pushSnack={pushSnack}/>
}

export default function App() {
  const { t } = useTranslation();
  const [hydrated, setHydrated] = useState(false)
  const { name, setName } = useLocalName()
  const [connected, setConnected] = useState(false)
  const [live, setLive] = useState<string[]>([])
  const [state, setState] = useState<ServerState | null>(null)
  const [tab, setTab] = useState<TabKey>('session')
  const [you, setYou] = useState<You | null>(null)
  const [starting, setStarting] = useState(false)
  const [interlude, setInterlude] = useState<{
    text: string
    until: number
    lastOutcome?: { id: string; title: string; outcome: 'passed' | 'rejected' } | null
  } | null>(null)
  const [preSession, setPreSession] = useState<{ text: string; until: number } | null>(null)
  const [ending, setEnding] = useState<any | null>(null)
  const { curr: yourInfluence, flash: xpFlash, delta: xpDelta } =
    useInfluenceGain(you?.name ?? null, state, hydrated)
  const { snacks, push: pushSnack, remove } = useSnackQueue()

  useEffect(() => {
    if (!hydrated) return
    if (xpDelta > 0) {
      playSound('xp').catch(() => {})
      pushSnack(t('snack.gainInfluence', { amount: xpDelta }), 'success')
    }
  }, [xpDelta, hydrated, pushSnack, t])

  useEffect(() => {
    if (!name) return
    ws.connect(name)

    const unsubs = [
      ws.onLive(setLive),
      ws.onState(patch => {
          setState(s => ({ ...(s || {} as any), ...patch }) as any)
          if (!hydrated) setHydrated(true)
        }),
      ws.onYou(setYou),
      ws.onSession(sess => {
        setState(s => ({ ...(s || {} as any), session: sess }) as any)
        setStarting(false)
        if (sess && sess.status === 'active') setTab('session')
      }),
      ws.onPreSession(p => setPreSession({ text: p.text, until: Date.now() + p.seconds * 1000 })),
      ws.onInterlude(p => setInterlude({
        text: p.text,
        until: Date.now() + p.seconds * 1000,
        lastOutcome: p.lastOutcome || null,
      })),
      ws.onEnding(summary => {
        setEnding(summary)
        setState(s => ({ ...(s || {} as any), session: null }) as any)
        setTab('session')
      }),
      ws.onSound(async (kind) => {
            playSound(kind as any);
            if (kind === 'pass') {
              // Confetti on pass
              celebratePass();
           }
          }),
      ws.onReminder((at, title) => {
        const ms = at - Date.now()
        if (ms > 0) setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification('Event Reminder / Υπενθύμιση Εκδήλωσης', { body: title })
          } else {
            alert('Event Reminder: ' + title)
          }
        }, ms)
      }),
    ]

    return () => unsubs.forEach(u => u())
  }, [name])



  useEffect(() => {
    const unlock = async () => {
      try {
        // Try to start and immediately stop a quiet audio to unlock
        const a = new Audio(FILE_SOUNDS.start);
        a.volume = 0;
        await a.play().catch(() => {});
        a.pause();
        a.currentTime = 0;
      } finally {
        window.removeEventListener('pointerdown', unlock);
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  useEffect(() => {
    if (interlude?.lastOutcome?.outcome === 'passed') {
      celebratePass();
    }
  }, [interlude?.lastOutcome?.id]);
  useEffect(() => {
    if (!preSession) return;
    const timer = setInterval(() => {
      if (Date.now() >= preSession.until) { setPreSession(null); clearInterval(timer); }
    }, 200);
    return () => clearInterval(timer);
  }, [preSession]);

  useEffect(()=>{
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission().catch(()=>{})
    }
  }, [])
  useEffect(() => {
    if (!interlude) return;
    const timer = setInterval(() => {
      if (Date.now() >= interlude.until) { setInterlude(null); clearInterval(timer); }
    }, 200);
    return () => clearInterval(timer);
  }, [interlude]);

  const beginSession = () => {
    const isVoting = Boolean(state?.session && state.session.status === 'active')
    const overlayActive = Boolean(
      (preSession && Date.now() < preSession.until) ||
      (interlude && Date.now() < interlude.until)
    )

    const canStart = !overlayActive && live.length >= state.settings.requiredMembers && !isVoting

    if (!canStart) return
    setStarting(true)
    ws.startSession()
    setTab('session') // take user straight to the session tab
  }

  if (!name) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white">
        <div className="mx-auto max-w-lg p-6 pt-16">
          <div className="card p-6">
            <h1 className="text-2xl font-bold mb-2">Family Council / Οικογενειακό Συμβούλιο</h1>
            <p className="text-slate-600 text-sm mb-4">Enter your name (saved on this device). / Εισάγετε το όνομά σας (αποθηκεύεται στη συσκευή).</p>
            <input className="input" placeholder="Your name / Το όνομά σας" onKeyDown={e=> e.key==='Enter' && setName((e.target as HTMLInputElement).value)} />
            <button className="btn-primary mt-3" onClick={()=>{
              const inp = document.querySelector('input') as HTMLInputElement
              if (!inp.value.trim()) return
              setName(inp.value.trim())
            }}>Continue / Συνέχεια</button>
          </div>
        </div>
      </div>
    )
  }

  if (!state || !you) {
    return <div className="p-6 text-slate-600">Connecting... / Σύνδεση...</div>
  }

  const isVoting = Boolean(state.session && state.session.status === 'active')
  const canStart = live.length >= state.settings.requiredMembers && !isVoting

  const buttonLabel = isVoting
    ? t('actions.votingInProgress')
    : starting
      ? t('actions.starting')
      : t('actions.begin')

  const buttonClass = isVoting || starting
    ? 'btn bg-rose-600 text-white hover:bg-rose-700'
    : (canStart ? 'btn btn-primary' : 'btn btn-secondary opacity-60 cursor-not-allowed')

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <Header live={live} you={you} youInfluence={yourInfluence} xpFlash={xpFlash} />




      {/* ENDING first: takes precedence */}
      {ending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur">
          <div className="card p-6 max-w-3xl w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">Session Summary / Σύνοψη Συνεδρίας</h3>
              <button className="btn btn-secondary" onClick={()=>setEnding(null)}>Close / Κλείσιμο</button>
            </div>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="card p-3"><div className="text-xs text-slate-500">{t('overlays.proposalsVoted')}</div><div className="text-2xl font-bold">{ending.total}</div></div>
              <div className="card p-3"><div className="text-xs text-slate-500">{t('overlays.passed')}</div><div className="text-2xl font-bold">{ending.passed}</div></div>
              <div className="card p-3"><div className="text-xs text-slate-500">{t('overlays.rejected')}</div><div className="text-2xl font-bold">{ending.rejected}</div></div>
            </div>
            <div className="mt-3 text-xs text-slate-600">
              {t('overlays.avgTime')}: {Math.round((ending.avgMs||0)/1000)}s •  {t('overlays.totalTime')}: {Math.round((ending.totalMs||0)/1000)}s
            </div>
            {(ending.fastest || ending.slowest) && (
              <div className="mt-2 grid md:grid-cols-2 gap-3 text-sm">
                {ending.fastest && <div className="card p-3">Fastest / Ταχύτερη: <span className="font-medium">{ending.fastest.title}</span> — {Math.round(ending.fastest.totalVotingMs/1000)}s, rounds {ending.fastest.rounds}</div>}
                {ending.slowest && <div className="card p-3">Slowest / Πιο Αργή: <span className="font-medium">{ending.slowest.title}</span> — {Math.round(ending.slowest.totalVotingMs/1000)}s, rounds {ending.slowest.rounds}</div>}
              </div>
            )}
            <div className="mt-4 max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr><th>Title / Τίτλος</th><th>Outcome / Έκβαση</th><th>Rounds / Γύροι</th><th>Time / Χρόνος</th><th>Accept/Reject</th></tr>
                </thead>
                <tbody>
                  {ending.items.map((it:any)=>(
                    <tr key={it.id} className="border-t">
                      <td className="py-1">{it.title}</td>
                      <td>{it.outcome}</td>
                      <td>{it.rounds}</td>
                      <td>{Math.round((it.totalVotingMs||0)/1000)}s</td>
                      <td>{it.acceptCount}/{it.rejectCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Tip: Author comments reset the timer and add a round. / Τα σχόλια του συγγραφέα επανεκκινούν τον χρόνο και προσθέτουν γύρο.
            </div>
          </div>
        </div>
      )}
      {!ending && interlude && Date.now() < interlude.until && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur">
          <div className="card p-8 text-center">

            {/* Outcome pill + title */}
            {interlude.lastOutcome && (
              <div className="mb-3">
                <div
                  className={clsx(
                    'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm',
                    interlude.lastOutcome.outcome === 'passed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  )}
                >
                  <span>{interlude.lastOutcome.outcome === 'passed' ? '✅' : '❌'}</span>
                  <span className="font-semibold">
                    {interlude.lastOutcome.outcome === 'passed' ? t('status.passed') : t('status.rejected')}
                  </span>
                </div>
                <div className="mt-2 text-base font-medium">{interlude.lastOutcome.title}</div>
              </div>
            )}

            {/* “Loading next…” label + countdown */}
            <div className="animate-pulse text-sm text-slate-600 mb-1">
              {t('overlays.interlude')}
            </div>
            <div className="text-2xl font-bold">
              {Math.max(0, Math.ceil((interlude.until - Date.now()) / 1000))}s
            </div>
          </div>
        </div>
      )}


      {!ending && preSession && Date.now() < preSession.until && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur">
          <div className="card p-8 text-center">
            <div className="animate-pulse text-lg font-semibold mb-2">
              {preSession.text}
            </div>
            <div className="text-2xl font-bold">
              {Math.max(0, Math.ceil((preSession.until - Date.now()) / 1000))}s
            </div>
            <div className="text-xs text-slate-600 mt-1">Go to Active Session tab / Μετάβαση στην Ενεργή Συνεδρία</div>
          </div>
        </div>
      )}


      <div className="mx-auto max-w-6xl px-4 mt-6 flex items-center gap-2">
      <button
        className={buttonClass}
        onClick={beginSession}
        disabled={!canStart || isVoting}
      >
      {buttonLabel}
      </button>

        {you.isAdmin && (
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
                defaultValue={state.settings.requiredMembers}
                onBlur={e => ws.updateSettings({ requiredMembers: Number(e.target.value) })}
              />

              <label className="label" htmlFor="count">{t('admin.countdown')}</label>
              <input
                id="count"
                type="number"
                className="input"
                defaultValue={state.settings.countdownSeconds}
                onBlur={e => ws.updateSettings({ countdownSeconds: Number(e.target.value) })}
              />

              <label className="label" htmlFor="inter">{t('admin.interlude')}</label>
              <input
                id="inter"
                type="number"
                className="input"
                defaultValue={state.settings.interludeSeconds}
                onBlur={e => ws.updateSettings({ interludeSeconds: Number(e.target.value) })}
              />

              <label className="label" htmlFor="pre">{t('admin.preSession')}</label>
              <input
                id="pre"
                type="number"
                className="input"
                defaultValue={state.settings.preSessionSeconds}
                onBlur={e => ws.updateSettings({ preSessionSeconds: Number(e.target.value) })}
              />
            </div>
          </details>
        )}

      </div>

      <Tabs tab={tab} setTab={setTab} />

      {tab === 'proposals' && <ProposalsTab state={state} you={you} pushSnack={pushSnack} />}
      {tab === 'rankings' && <RankingsTab state={state} you={you} />}
      {tab === 'session' && <SessionTab state={state} you={you} pushSnack={pushSnack} />}
      <SnackStack snacks={snacks} onClose={remove} />

    </div>
  )
}
