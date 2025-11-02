import React from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { format } from 'date-fns'
import { dfLocale } from '../../utils/dates'
import { TYRANT_COST } from '../../utils/constants'
import { ws } from '../../services/ws'
import { Proposal, ServerState, VoteChoice, You } from '../../types'

export default function ActiveSessionView({
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

            {/* Votes */}
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
                pushSnack(t('snack.tyrantLost', { amount: TYRANT_COST }), 'warning')
              }}
            >
              {t('actions.tyrantVeto') || 'Tyrant: Veto'}
            </button>
          </div>
        </div>

        {/* Author updates */}
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
