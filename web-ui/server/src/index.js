import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '../data')

const stateFile = path.join(DATA_DIR, 'state.json')

function loadState() {
  if (!fs.existsSync(stateFile)) {
    const initial = {
      proposals: [],
      users: {},
      settings: { requiredMembers: 3, countdownSeconds: 180, interludeSeconds: 5, preSessionSeconds: 5 }
    }
    fs.writeFileSync(stateFile, JSON.stringify(initial, null, 2))
    return initial
  }
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
    if (!s.settings) s.settings = { requiredMembers: 3, countdownSeconds: 180, interludeSeconds: 5 }
    if (s.settings.interludeSeconds == null) s.settings.interludeSeconds = 5
    if (s.settings.preSessionSeconds == null) s.settings.preSessionSeconds = 5
    return s
  } catch {
    return { proposals: [], users: {}, settings: { requiredMembers: 3, countdownSeconds: 180, interludeSeconds: 5 } }
  }
}

function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
}

let state = loadState()
let canStartNextAt = 0       // epoch ms; 0 = allowed any time
let live = new Map() // ws -> name
let session = null // { id, proposalId, startedAt, durationSeconds, votes:{}, attendees:[], status, reason }
let meeting = null               // track a “meeting” across proposals
let preparingSession = false     // pre-session 5s countdown in progress
let prepareTimer = null
let interludeUntil = 0
let interludeTimer = null

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/state', (req,res)=>{
  res.json({ ...state, live: Array.from(new Set(live.values())), session })
})

const server = app.listen(3001, '0.0.0.0', () => {
  console.log('WS/HTTP server on :3001')
})

const wss = new WebSocketServer({ server })
function inInterlude() {
  return interludeUntil && Date.now() < interludeUntil
}

function broadcast(obj) {
  const data = JSON.stringify(obj)
  wss.clients.forEach(c=>{
    try { c.send(data) } catch {}
  })
}

function pickNextProposal() {
  const open = state.proposals.filter(p => p.status === 'open')
  open.sort((a,b) => new Date(a.voteDeadline).getTime() - new Date(b.voteDeadline).getTime())
  return open[0] || null
}

function startVotingSession() {
  if (inInterlude() || preparingSession) return
  if (session && session.status === 'active') return

  // Ensure a meeting exists
  if (!meeting || meeting.status !== 'active') {
    meeting = { status: 'active', startedAt: Date.now(), items: [] }
  }

  const proposal = pickNextProposal()
  if (!proposal) return

  proposal.stats = proposal.stats || { rounds: 1, totalVotingMs: 0, firstStartedAt: Date.now() }

  const currentLive = Array.from(new Set(live.values()))
  session = {
    id: 's_' + Math.random().toString(36).slice(2),
    proposalId: proposal.id,
    startedAt: Date.now(),
    durationSeconds: state.settings.countdownSeconds || 180,
    votes: {},
    attendees: currentLive.slice(),      // for UI
    votingSet: currentLive.slice(),      // ← frozen for this round
    round: 1,                            // ← round counter
    status: 'active',
    awaitingAuthorAdjust: false
  }
  broadcast({ type: 'session', session })
}




function endSession(reason) {
  if (!session) return
  console.log('endSession',reason)
  session.status = 'ended'
  session.reason = reason
  broadcast({ type: 'session', session })
  session = null
  if (reason === 'timeout') {
    if (meeting && meeting.status === 'active') {
      meeting.status = 'ended'
      meeting.endedAt = Date.now()
      broadcastEndingSummary()
      meeting = null
    }
  }
}

function broadcastEndingSummary() {
  try {
    const items = meeting?.items || []
    const total = items.length
    const passed = items.filter(i=>i.outcome==='passed').length
    const rejected = items.filter(i=>i.outcome==='rejected').length
    const totalMs = items.reduce((a,b)=> a + (b.totalVotingMs||0), 0)
    const avgMs = total ? Math.round(totalMs / total) : 0
    const fastest = items.slice().sort((a,b)=> (a.totalVotingMs||0)-(b.totalVotingMs||0))[0] || null
    const slowest = items.slice().sort((a,b)=> (b.totalVotingMs||0)-(a.totalVotingMs||0))[0] || null
    broadcast({ type: 'ending', summary: {
      total, passed, rejected,
      totalMs, avgMs, fastest, slowest,
      items
    }})
  } catch (e) { console.error('ending summary error', e) }
}

// Tick once per second while a voting session is active.
// - Ends the session on timeout
// - Resolves early if everyone has voted
function checkTimerTick() {
  if (!session || session.status !== 'active') return
  const deadline = session.startedAt + session.durationSeconds * 1000
  if (Date.now() >= deadline) {
    endSession('timeout') // NO automatic next here
  } else if (Object.keys(session.votes).length >= (session.attendees?.length || 0)) {
    resolveVotes()
  }
}
setInterval(checkTimerTick, 1000)

// replace the whole function
function scheduleNextWithInterludeOrEnd(lastOutcome) {
  const next = pickNextProposal()
  const secs = Number(state.settings.interludeSeconds) || 5

  endSession('completed')

  interludeUntil = Date.now() + secs * 1000
  clearTimeout(interludeTimer)
  broadcast({
    type: 'interlude',
    seconds: secs,
    text: 'Loading next proposal / Φόρτωση επόμενης πρότασης...',
    lastOutcome: lastOutcome || null
  })

  interludeTimer = setTimeout(() => {
    interludeUntil = 0
    if (next) {
      startVotingSession()
    } else {
      // no more proposals → end meeting after interlude
      if (meeting && meeting.status === 'active') {
        meeting.status = 'ended'
        meeting.endedAt = Date.now()
        broadcastEndingSummary()
        meeting = null
      }
    }
  }, secs * 1000)
}


function pointsForPass(proposal, votes) {
  // unanimous accept -> author +10, every accepter +5
  const uniqueVotes = new Set(Object.values(votes))
  if (uniqueVotes.size === 1 && uniqueVotes.has('accept')) {
    const author = proposal.author
    state.users[author] = state.users[author] || { name: author, democracy: 0, tyrant: 0 }
    state.users[author].democracy += 10
    for (const [name, choice] of Object.entries(votes)) {
      if (name !== author && choice === 'accept') {
        state.users[name] = state.users[name] || { name, democracy: 0, tyrant: 0 }
        state.users[name].democracy += 5
      }
    }
    saveState()
  }
}

function scheduleReminder(proposal) {
  if (!proposal.eventDate) return
  const when = new Date(proposal.eventDate).getTime() - 5*60*1000 // 5 minutes before
  broadcast({ type: 'reminder', at: when, title: 'Upcoming: ' + proposal.title })
}

function resolveVotes() {
  if (!session) return
  const proposal = state.proposals.find(p=>p.id===session.proposalId)
  const votes = session.votes
  const required = session.votingSet || session.attendees || []
  const allVoted = required.every(n => votes[n])
  if (!allVoted) return

  // accumulate time spent in this final round
  proposal.stats = proposal.stats || { rounds: 1, totalVotingMs: 0, firstStartedAt: session.startedAt }
  proposal.stats.totalVotingMs += (Date.now() - session.startedAt)
  proposal.stats.resolvedAt = Date.now()

  const uniqueVotes = new Set(Object.values(votes))
  if (uniqueVotes.size === 1) {
    const only = uniqueVotes.values().next().value
    if (only === 'accept') {
      proposal.status = 'passed'
      pointsForPass(proposal, votes)
      saveState()
      broadcast({ type: 'state', patch: { proposals: state.proposals, users: state.users } })
      broadcast({ type: 'sound', kind: 'pass' })
      broadcast({ type: 'sound', kind: 'gavel' })
      scheduleReminder(proposal)
    } else {
      proposal.status = 'rejected'
      saveState()
      broadcast({ type: 'state', patch: { proposals: state.proposals } })
      broadcast({ type: 'sound', kind: 'reject' })
      broadcast({ type: 'sound', kind: 'gavel' })
    }

    // Record in meeting items — count accept/reject on the REQUIRED set
    if (meeting && meeting.status === 'active') {
      const acceptCount = required.filter(n => votes[n] === 'accept').length
      const rejectCount = required.filter(n => votes[n] === 'reject').length
      meeting.items.push({
        id: proposal.id,
        title: proposal.title,
        author: proposal.author,
        outcome: proposal.status,
        rounds: proposal.stats?.rounds || 1,
        totalVotingMs: proposal.stats?.totalVotingMs || (Date.now() - (proposal.stats?.firstStartedAt || session.startedAt)),
        acceptCount, rejectCount,
      })
    }

    const lastOutcome = { id: proposal.id, title: proposal.title, outcome: proposal.status }
    scheduleNextWithInterludeOrEnd(lastOutcome)
  } else {
    // not unanimous → require author adjustment
    session.awaitingAuthorAdjust = true
    broadcast({ type: 'session', session })
  }
}



wss.on('connection', (socket) => {
  let myName = null

  socket.on('message', (buf) => {
    try {
      const msg = JSON.parse(buf.toString())
      if (msg.type === 'hello') {
        myName = String(msg.name || '').trim()
        live.set(socket, myName)
        if (!state.users[myName]) state.users[myName] = { name: myName, democracy: 0, tyrant: 0 }
        saveState()
        socket.send(JSON.stringify({ type: 'welcome', state: { ...state, live: Array.from(new Set(live.values())), session }, you: { name: myName, isAdmin: myName.toLowerCase() === 'alex' } }))
        broadcast({ type: 'live', live: Array.from(new Set(live.values())) })
      } else if (msg.type === 'createProposal') {
        const p = msg.payload
        const id = 'p_' + Math.random().toString(36).slice(2)

        // fallback to "now" if missing/invalid
        let voteDeadline = p.voteDeadline
        const t = Date.parse(voteDeadline || '')
        if (!voteDeadline || isNaN(t)) voteDeadline = new Date().toISOString()

        const proposal = {
          id,
          title: p.title,
          description: p.description,
          voteDeadline,                // ← always set now or parsed ISO
          eventDate: p.eventDate,
          author: p.author,
          status: 'open',
          createdAt: Date.now(),
          comments: []
        }
        state.proposals.push(proposal)
        saveState()
        broadcast({ type: 'state', patch: { proposals: state.proposals } })
      } else if (msg.type === 'editProposal') {
        const { id, patch } = msg
        const p = state.proposals.find(x => x.id === id)
        if (!p) return
        const isAlex = myName && myName.toLowerCase() === 'alex'
        if (p.author !== myName && !isAlex) return
        Object.assign(p, patch)
        saveState()
        broadcast({ type: 'state', patch: { proposals: state.proposals } })
      } else if (msg.type === 'startSession') {
        const liveCount = Array.from(new Set(live.values())).length
        const need = state.settings.requiredMembers || 3
        if (session || preparingSession) return
        if (inInterlude()) {
          socket.send(JSON.stringify({ type: 'toast', text: 'Please wait — interlude in progress' }))
          return
        }
        if (liveCount < need) {
          socket.send(JSON.stringify({ type: 'toast', text: `Need at least ${need} members live` }))
          return
        }

        const secs = Number(state.settings.preSessionSeconds || 5)
        preparingSession = true
        broadcast({ type: 'preSession', seconds: secs, text: 'Session starts in / Η συνεδρία ξεκινά σε' })
        broadcast({ type: 'sound', kind: 'start' })

        clearTimeout(prepareTimer)
        prepareTimer = setTimeout(() => {
          preparingSession = false
          startVotingSession()
        }, secs * 1000)
      } else if (msg.type === 'vote') {
        if (!session) return
        const name = myName
        const currentLive = Array.from(new Set(live.values()))

        // Add to attendees for display (optional)
        if (!session.attendees.includes(name) && currentLive.includes(name)) {
          session.attendees.push(name)
        }

        // Only accept votes from currently live people
        if (!currentLive.includes(name)) return

        session.votes[name] = msg.choice // 'accept' | 'reject'
        broadcast({ type: 'session', session })
        resolveVotes()
      } else if (msg.type === 'authorAdjust') {
        const { proposalId, text, eventDate } = msg
        const p = state.proposals.find(x=>x.id===proposalId)
        if (!p) return
        if (p.author !== myName) return
        if (!session || session.status !== 'active' || session.proposalId !== proposalId) return

        const entry = { author: myName, timestamp: Date.now() }
        if (text && text.trim()) entry.text = text.trim()
        // Record comment + change as a single entry
        if (eventDate) {
          entry.eventDate = eventDate
          p.eventDate = eventDate
        }
        // Only push if there's at least some content (text or eventDate change)
        if (entry.text || entry.eventDate) {
          p.comments.push(entry)
        }


        if (session && session.proposalId === proposalId) {
          // accumulate time spent so far, increase rounds
          p.stats = p.stats || { rounds: 1, totalVotingMs: 0, firstStartedAt: session.startedAt }
          p.stats.totalVotingMs += (Date.now() - session.startedAt)
          p.stats.rounds = (p.stats.rounds || 1) + 1

          const currentLive = Array.from(new Set(live.values()))
          session.votes = {}
          session.startedAt = Date.now()
          session.awaitingAuthorAdjust = false
          session.round = (session.round || 1) + 1
          session.votingSet = currentLive.slice()            // ← freeze new required set
          session.attendees = Array.from(new Set([...session.attendees, ...currentLive])) // track everyone seen
        }
        saveState()
        broadcast({ type: 'state', patch: { proposals: state.proposals } })
        broadcast({ type: 'session', session })
      } else if (msg.type === 'tyrant') {
        const action = msg.action // 'enforce' | 'veto'
        if (!session) return
        const p = state.proposals.find(x => x.id === session.proposalId)
        if (!p) return

        // award tyrant points
        state.users[myName] = state.users[myName] || { name: myName, democracy: 0, tyrant: 0 }
        state.users[myName].tyrant += 20

        if (action === 'enforce') {
          p.status = 'passed'
          saveState()
          broadcast({ type: 'state', patch: { proposals: state.proposals, users: state.users } })
          broadcast({ type: 'sound', kind: 'pass' })
          scheduleReminder(p)
        } else {
          p.status = 'rejected'
          saveState()
          broadcast({ type: 'state', patch: { proposals: state.proposals, users: state.users } })
          broadcast({ type: 'sound', kind: 'reject' })
        }

        // ⬇️ REPLACEMENT STARTS HERE
        if (meeting && meeting.status === 'active') {
          const stats = (state.proposals.find(x => x.id === p.id)?.stats) || { rounds: 1, totalVotingMs: 0 }
          meeting.items.push({
            id: p.id,
            title: p.title,
            author: p.author,
            outcome: p.status,
            rounds: stats.rounds || 1,
            totalVotingMs: stats.totalVotingMs || 0,
            acceptCount: 0,
            rejectCount: 0,
          })
        }

        const lastOutcome = { id: p.id, title: p.title, outcome: p.status }
        scheduleNextWithInterludeOrEnd(lastOutcome)
      } else if (msg.type === 'updateSettings') {
        if (myName?.toLowerCase() !== 'alex') return
        const patch = { ...msg.settings }
        if (patch.requiredMembers != null) patch.requiredMembers = Math.max(1, Number(patch.requiredMembers) || 1)
        if (patch.countdownSeconds != null) patch.countdownSeconds = Math.max(10, Number(patch.countdownSeconds) || 180)
        if (patch.interludeSeconds != null) patch.interludeSeconds = Math.max(1, Number(patch.interludeSeconds) || 1)
        if (patch.preSessionSeconds != null) patch.preSessionSeconds = Math.max(1, Number(patch.preSessionSeconds) || 1)
        state.settings = { ...state.settings, ...patch }
        saveState()
        broadcast({ type: 'state', patch: { settings: state.settings } })
      }


// --- ADMIN: delete a proposal by id ---
 else if (msg.type === 'deleteProposal') {
  if (myName?.toLowerCase() !== 'alex') return
  const { id } = msg
  const idx = state.proposals.findIndex(p => p.id === id)
  if (idx === -1) return

  // If this proposal is currently being voted, end the session.
  if (session && session.proposalId === id) {
    endSession('proposal_deleted')
  }

  state.proposals.splice(idx, 1)
  saveState()
  broadcast({ type: 'state', patch: { proposals: state.proposals } })

// --- ADMIN: delete a user by name ---
} else if (msg.type === 'deleteUser') {
  if (myName?.toLowerCase() !== 'alex') return
  const { name } = msg
  if (!name) return

  // Remove from scoreboard
  if (state.users[name]) {
    delete state.users[name]
  }

  // If a session is active, remove attendee and their vote
  if (session) {
    session.attendees = session.attendees.filter(n => n !== name)
    if (session.votes && session.votes[name]) {
      delete session.votes[name]
    }
    broadcast({ type: 'session', session })
    // If everyone left or everyone has now voted, resolve/end
    if (session.attendees.length === 0) {
      endSession('no_attendees')
    } else if (Object.keys(session.votes).length >= session.attendees.length) {
      resolveVotes()
    }
  }

  saveState()
  broadcast({ type: 'state', patch: { users: state.users } })}


    ///---------------------------------------------------------
    } catch (e) {
      console.error('ws msg error', e)
    }
  })

  socket.on('close', () => {
    live.delete(socket)
    if (session && session.votingSet?.includes(myName) && !session.votes?.[myName]) {
      session.votingSet = session.votingSet.filter(n => n !== myName)
      broadcast({ type: 'session', session })
      if ((Object.keys(session.votes).length) >= (session.votingSet.length || 0)) {
        resolveVotes()
      }
    }
    broadcast({ type: 'live', live: Array.from(new Set(live.values())) })
  })
})
