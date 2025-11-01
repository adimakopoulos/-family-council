import React, { useEffect, useMemo, useState } from 'react'
import { ws } from './services/ws'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { Proposal, VoteChoice, ServerState, You } from './types'
import { TIERS, tierIndexForScore, netScore } from './utils/rankings'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import i18n from './i18n'
import { enUS, el as elLocale } from 'date-fns/locale'

export function dfLocale() {
  return i18n.language.startsWith('el') ? elLocale : enUS
}

type TabKey =   'session' | 'proposals'| 'rankings'

const PASS_BEEP = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQwAAACAgICAj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+'
const REJECT_BEEP = 'data:audio/wav;base64,UklGRoQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQwAAAA/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pw=='
const START_BEEP = 'data:audio/wav;base64, UklGRoQAAABXQVZF...'     // short “get ready” ping
const GAVEL = 'data:audio/wav;base64, UklGRtQAAABXQVZF...'          // percussive click-like
// (Optionally: try to load /gavel.mp3 if you add a real file in client/public)
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

function Header({ live, you }: { live: string[], you: You | null }) {
  const { t } = useTranslation()
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
        <div className="flex items-center gap-4">
          {you && (
            <div className="text-sm text-slate-600">
              {you.isAdmin ? t('role.admin') : t('role.member')} — {you.name}
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


function ProposalsTab({ state, you }:{ state: ServerState, you: You }) {
  const { t } = useTranslation()
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
              {p.comments?.length ? (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Comments / Σχόλια</div>
                  <ul className="space-y-1">
                    {p.comments.map((c, idx) => (
                      <li key={idx} className="text-xs text-slate-700">
                        <span className="font-medium">{c.author}</span>: <span className="whitespace-pre-wrap break-words">{c.text}</span>
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
  const sorted = [...users].sort((a,b)=> (netScore(b) - netScore(a)))
  return (
    <div className="mx-auto max-w-5xl px-4 mt-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Leaderboard / Πίνακας Κατάταξης</h2>
          <div className="space-y-3">
            {sorted.map(u => {
              const score = netScore(u)
              const idx = tierIndexForScore(score)
              const tier = TIERS[idx]
              return (
                <div key={u.name} className="border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-slate-500">Score / Βαθμολογία: <span className="font-medium">{score}</span> (Democracy: {u.democracy || 0}, Tyrant: {u.tyrant || 0})</div>
                    <div className="text-sm mt-1"><span className="font-medium">{tier.title}</span></div>
                    <div className="text-xs text-slate-500">{tier.description}</div>
                  </div>
  {/** Admin-only delete user */}
  {state && (state as any) && (/* just to be safe */ true) && (
    you?.isAdmin ? (
      <button
        className="btn bg-rose-600 text-white hover:bg-rose-700"
        onClick={() => {
          if (confirm(`Delete user "${u.name}"? / Διαγραφή χρήστη "${u.name}";`)) {
            ws.deleteUser(u.name)
          }
        }}
      >
        Delete User / Διαγραφή Χρήστη
      </button>
    ) : null
  )}



                </div>
              )
            })}
            {sorted.length === 0 && <div className="text-slate-500 text-sm">No members yet. / Δεν υπάρχουν μέλη ακόμα.</div>}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Tiers / Βαθμίδες</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {TIERS.map((t, i) => (
              <li key={i}><span className="font-medium">{t.title}</span> — {t.description}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function SessionTab({ state, you }:{ state: ServerState, you: You}) {
  const { t } = useTranslation()
  const session = state.session
  const yourVote = (session?.votes && (session.votes as any)[you.name]) as VoteChoice | undefined || null

  const [now, setNow] = useState(Date.now())
  const [comment, setComment] = useState('')
  const [newEventDate, setNewEventDate] = useState('')

  useEffect(()=>{
    const t = setInterval(()=>setNow(Date.now()), 500)
    return ()=>clearInterval(t)
  }, [])

  useEffect(() => {
      setComment('')
      setNewEventDate('')
  }, [session?.proposalId])

  if (!session || session.status !== 'active') {
    return (
      <div className="mx-auto max-w-4xl px-4 mt-6">
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-600 mb-4">{t('session.noActive')}</p>
          <p className="text-xs text-slate-500">{t('session.quote')}</p>
        </div>
      </div>
    )
  }

  const proposal = state.proposals.find(p=>p.id===session.proposalId)
  const deadline = session.startedAt + session.durationSeconds*1000
  const remaining = Math.max(0, Math.floor((deadline - now)/1000))
  const total = session.attendees.length
  const cast = Object.keys(session.votes || {}).length
  const everyoneVoted = cast >= total
  const votedDisplay = Object.entries(session.votes || {}).map(([k,v])=> `${k}: ${v}`).join(', ')

  const castVote = (choice: VoteChoice) => {
    ws.vote(choice)
  }

  const canAuthorAdjust = proposal && proposal.author === you.name
  const needAdjust = Boolean(state.session?.awaitingAuthorAdjust)

  return (
    <div className="mx-auto max-w-4xl px-4 mt-6">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">{t('session.voting')}</div>
            <h3 className="text-xl font-semibold">{proposal?.title}</h3>
            <p className="text-sm text-slate-600">{proposal?.description}</p>
            <div className="text-xs text-slate-500 mt-1">{t('session.votesCast')}: <span className="font-medium">{cast}/{total}</span></div>
            {everyoneVoted && <div className="text-xs text-slate-600 mt-1">{t('session.results')}: {votedDisplay}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">{t('session.timeLeft')}</div>
            <div className={clsx('text-2xl font-bold', remaining <= 10 ? 'text-red-600' : 'text-slate-800')}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2, '0')}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button className="btn-primary" onClick={()=>castVote('accept')}>{t('actions.accept') || 'Accept'}</button>
          <button className="btn-secondary" onClick={()=>castVote('reject')}>{t('actions.reject') || 'Reject'}</button>
          <div className="text-xs text-slate-600 ml-2">{t('session.yourVote')}: <span className="font-semibold">{yourVote || '—'}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn bg-amber-600 text-white hover:bg-amber-700" onClick={()=>ws.tyrant('enforce')}>{t('actions.tyrantEnforce')}</button>
            <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={()=>ws.tyrant('veto')}>{t('actions.tyrantVeto')}</button>
          </div>
        </div>

        {canAuthorAdjust && needAdjust && (
          <div className="mt-5 border-t pt-4">
            <div className="text-sm font-medium mb-2">Not unanimous? Add comment & adjust event date / Μη ομόφωνο; Σχόλιο & αλλαγή ημερομηνίας</div>
            <textarea className="input h-20" placeholder="Comment / Σχόλιο" value={comment} onChange={e=>setComment(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <input type="datetime-local" className="input" value={newEventDate} onChange={e=>setNewEventDate(e.target.value)} />
              <button className="btn-secondary" onClick={()=>ws.authorAdjust(session.proposalId, comment, newEventDate || null)}>Submit / Υποβολή</button>
            </div>
          </div>
        )}

        <div className="mt-6 p-3 rounded-lg bg-slate-50 border text-xs text-slate-600">
          “Democracy is not just the right to vote, but the right to live in dignity, the right to have your voice heard, and the right to shape the future we all share. If you do not share these values you do not belong in here!”
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { t } = useTranslation();
  const { name, setName } = useLocalName()
  const [connected, setConnected] = useState(false)
  const [live, setLive] = useState<string[]>([])
  const [state, setState] = useState<ServerState | null>(null)
  const [tab, setTab] = useState<TabKey>('session')
  const [you, setYou] = useState<You | null>(null)
  const [starting, setStarting] = useState(false)
  const [interlude, setInterlude] = useState<{ text: string; until: number } | null>(null)
  const [preSession, setPreSession] = useState<{ text: string; until: number } | null>(null)
  const [ending, setEnding] = useState<any | null>(null)


  useEffect(()=>{
    if (!name) return
    ws.connect(name)
    ws.onLive(setLive)
    ws.onState(patch => setState(s => ({...(s||{} as any), ...patch}) as any))
    ws.onYou(setYou)
    ws.onSession(sess => {
      // Keep exactly what server sends; UI will hide ended sessions itself
      setState(s => ({ ...(s || {} as any), session: sess }) as any)
      setStarting(false)
      // Optional: jump users to the Session tab when a new session becomes active
      if (sess && sess.status === 'active') setTab('session')
    })
    ws.onPreSession(p => {
      setPreSession({ text: p.text, until: Date.now() + p.seconds * 1000 })
    })

    ws.onEnding(summary => {
      setEnding(summary)
      setState(s => ({ ...(s || {} as any), session: null }) as any)
      setTab('session') // optional
    })
    ws.onSound(kind => {
      let src = ''
      if (kind === 'pass') src = PASS_BEEP
      else if (kind === 'reject') src = REJECT_BEEP
      else if (kind === 'start') src = START_BEEP
      else if (kind === 'gavel') src = GAVEL

      if (src) new Audio(src).play().catch(()=>{})
    })
    ws.onReminder((at, title)=>{
      const ms = at - Date.now()
      if (ms > 0) {
        setTimeout(()=>{
          if (Notification.permission === 'granted') {
            new Notification('Event Reminder / Υπενθύμιση Εκδήλωσης', { body: title })
          } else {
            alert('Event Reminder: ' + title)
          }
        }, ms)
      }
    })
    ws.onInterlude(p => {
      setInterlude({ text: p.text, until: Date.now() + p.seconds * 1000 })
    })
    setConnected(true)
  }, [name])



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
      <Header live={live} you={you} />



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
                              <div className="animate-pulse text-lg font-semibold mb-2">
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

      {tab === 'proposals' && <ProposalsTab state={state} you={you} />}
      {tab === 'rankings' && <RankingsTab state={state} you={you} />}
      {tab === 'session' && <SessionTab state={state} you={you} />}
    </div>
  )
}
