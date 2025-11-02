import React from 'react'
import { ServerState, You } from '../../types'
import XPBar from '../XPBar'
import { influenceScore, tierProgress, INFLUENCE_TIERS } from '../../utils/rankings'
import { ws } from '../../services/ws'

export default function RankingsTab({ state, you }:{
  state: ServerState; you: You
}) {
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
