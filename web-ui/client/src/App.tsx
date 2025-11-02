import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

import { ws } from './services/ws'
import { Proposal, VoteChoice, ServerState, You } from './types'

import HeaderBar from './components/layout/HeaderBar'
import Tabs, { TabKey } from './components/layout/Tabs'
import ProposalsTab from './components/proposals/ProposalsTab'
import RankingsTab from './components/rankings/RankingsTab'
import ActiveSessionView from './components/session/ActiveSessionView'
import NoActiveSession from './components/session/NoActiveSession'

import { useSnackQueue, SnackStack } from './components/Snackbar'
import { useLocalName } from './hooks/useLocalName'
import { useInfluenceGain } from './hooks/useInfluenceGain'

import { playSound, unlockAudio } from './utils/audio'
import { celebratePass } from './confetti'
import { TYRANT_COST } from './utils/constants'
import EndingOverlay from './components/overlays/EndingOverlay'
import InterludeOverlay from './components/overlays/InterludeOverlay'
import PreSessionOverlay from './components/overlays/PreSessionOverlay'

import ProposalArchiveTab from './components/proposals/ProposalArchiveTab'

function toLocalInput(dt: Date) {
  const z = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0,16) // "YYYY-MM-DDTHH:mm"
}





function SessionTab({ state, you, pushSnack }: {
  state: ServerState
  you: You
  pushSnack: (text: string, tone?: any)=>void
}) {
  const session = state.session
  const yourInfluence = state.users?.[you.name]?.influence ?? 0

  if (!session || session.status !== 'active') {
    return <NoActiveSession />
  }
  return (
    <ActiveSessionView
      state={state}
      you={you}
      session={session}
      yourInfluence={yourInfluence}
      canUseTyrant={yourInfluence >= TYRANT_COST}
      pushSnack={pushSnack}
    />
  )
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
      const unlock = () => { unlockAudio().finally(() =>
         window.removeEventListener('pointerdown', unlock)
      )}
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);



  useEffect(()=>{
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission().catch(()=>{})
    }
  }, [])


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
      <HeaderBar live={live} you={you} youInfluence={yourInfluence} xpFlash={xpFlash} />

      {/* overlays */}
      {ending && (
        <EndingOverlay
          summary={ending}
          onClose={() => setEnding(null)}
          playEndSound={() => {
            playSound('gavel').catch(() => {})
          }}
        />
      )}
      {!ending && interlude && Date.now() < interlude.until && (
        <InterludeOverlay
          until={interlude.until}
          text={interlude.text}
          lastOutcome={interlude.lastOutcome || null}
          onDone={() => setInterlude(null)}
        />
      )}
      {!ending && preSession && Date.now() < preSession.until && (
        <PreSessionOverlay
          until={preSession.until}
          text={preSession.text}
          onDone={() => setPreSession(null)}
        />
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
      {tab === 'archive' && <ProposalArchiveTab state={state} you={you} />}
      <SnackStack snacks={snacks} onClose={remove} />

    </div>
  )
}
