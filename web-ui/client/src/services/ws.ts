// client/src/services/ws.ts
import { ServerState, You, Proposal, VoteChoice, Settings } from '../types'

type Listener = (s: Partial<ServerState>) => void
type LiveListener = (l: string[]) => void
type SessionListener = (s: ServerState['session']) => void
type SoundKind = 'pass' | 'reject' | 'start' | 'gavel'
type SoundListener = (kind: SoundKind) => void
type YouListener = (y: You) => void
type ReminderListener = (at: number, title: string) => void

type InterludePayload = {
  seconds: number
  text: string
  lastOutcome?: { id: string; title: string; outcome: 'passed' | 'rejected' } | null
}
type InterludeListener = (p: InterludePayload) => void
type PreSessionListener = (p: { seconds: number; text: string }) => void

type EndingItem = {
  id: string
  title: string
  author: string
  outcome: 'passed' | 'rejected'
  rounds: number
  totalVotingMs: number
  acceptCount: number
  rejectCount: number
}
type EndingSummary = {
  total: number
  passed: number
  rejected: number
  totalMs: number
  avgMs: number
  items: EndingItem[]
  fastest?: EndingItem | null
  slowest?: EndingItem | null
}
type EndingListener = (s: EndingSummary) => void

function wsUrl() {
  const host = window.location.hostname
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${host}:3001`
}

class WSService {
  private socket: WebSocket | null = null
  private name: string | null = null
  private reconnectTimer: number | null = null
  private closedByUs = false

  // queue while not OPEN
  private outgoingQueue: any[] = []

  // listeners
  private listeners: Listener[] = []
  private liveListeners: LiveListener[] = []
  private sessionListeners: SessionListener[] = []
  private soundListeners: SoundListener[] = []
  private youListeners: YouListener[] = []
  private reminderListeners: ReminderListener[] = []
  private interludeListeners: InterludeListener[] = []
  private preSessionListeners: PreSessionListener[] = []
  private endingListeners: EndingListener[] = []

  state: ServerState | null = null
  you: You | null = null

  // ---- subscribe (return unsubscribe) ----
  onState(cb: Listener) { this.listeners.push(cb); return () => this.off(this.listeners, cb) }
  onLive(cb: LiveListener) { this.liveListeners.push(cb); return () => this.off(this.liveListeners, cb) }
  onSession(cb: SessionListener) { this.sessionListeners.push(cb); return () => this.off(this.sessionListeners, cb) }
  onSound(cb: SoundListener) { this.soundListeners.push(cb); return () => this.off(this.soundListeners, cb) }
  onYou(cb: YouListener) { this.youListeners.push(cb); return () => this.off(this.youListeners, cb) }
  onReminder(cb: ReminderListener) { this.reminderListeners.push(cb); return () => this.off(this.reminderListeners, cb) }
  onInterlude(cb: InterludeListener) { this.interludeListeners.push(cb); return () => this.off(this.interludeListeners, cb) }
  onPreSession(cb: PreSessionListener) { this.preSessionListeners.push(cb); return () => this.off(this.preSessionListeners, cb) }
  onEnding(cb: EndingListener) { this.endingListeners.push(cb); return () => this.off(this.endingListeners, cb) }

  private off<T>(arr: T[], cb: T) {
    const i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1)
  }

  // ---- connection guards ----
  private isConnectedFor(name: string) {
    return this.socket && this.socket.readyState === WebSocket.OPEN && this.name === name
  }

  connect(name: string) {
    // idempotent
    if (this.isConnectedFor(name)) return

    // close previous (prevents doubles)
    if (this.socket && this.socket.readyState <= 1) {
      try { this.closedByUs = true; this.socket.close(1000, 'reconnect') } catch {}
    }
    this.socket = null
    this.name = name
    this.closedByUs = false

    const url = wsUrl()
    const sock = new WebSocket(url)
    this.socket = sock

    sock.onopen = () => {
      // hello on THIS socket
      sock.send(JSON.stringify({ type: 'hello', name }))
      // flush queue through THIS socket
      while (this.outgoingQueue.length) {
        const data = this.outgoingQueue.shift()
        try { sock.send(JSON.stringify(data)) } catch {}
      }
    }

    sock.onmessage = (ev) => {
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      // console.log('[ws] incoming:', msg.type, msg)

      switch (msg.type) {
        case 'welcome':
          this.state = msg.state
          this.you = msg.you
          this.youListeners.forEach(cb => cb(this.you!))
          this.listeners.forEach(cb => cb(this.state!))
          break

        case 'state':
          this.state = { ...(this.state || {}), ...msg.patch }
          this.listeners.forEach(cb => cb(msg.patch))
          break

        case 'live':
          this.liveListeners.forEach(cb => cb(msg.live))
          break

        case 'session': {
          if (!this.state) this.state = {} as any
          const nextSession = msg.session && msg.session.status === 'active' ? msg.session : null
          this.state.session = nextSession
          this.sessionListeners.forEach(cb => cb(nextSession))
          break
        }

        case 'sound':
          this.soundListeners.forEach(cb => cb(msg.kind))
          break

        case 'reminder':
          this.reminderListeners.forEach(cb => cb(msg.at, msg.title))
          break

        case 'toast':
          alert(msg.text)
          break

        case 'interlude':
          this.interludeListeners.forEach(cb => cb({
            seconds: msg.seconds,
            text: msg.text,
            lastOutcome: msg.lastOutcome ?? null
          }))
          break

        case 'preSession':
          this.preSessionListeners.forEach(cb => cb({ seconds: msg.seconds, text: msg.text }))
          break

        case 'ending':
          this.endingListeners.forEach(cb => cb(msg.summary))
          break
      }
    }

    sock.onclose = () => {
      this.socket = null
      if (this.closedByUs) { this.closedByUs = false; return }
      if (this.reconnectTimer != null) return
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null
        if (this.name) this.connect(this.name)
      }, 800)
    }
  }

  destroy() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.closedByUs = true
    try { this.socket?.close(1000, 'destroy') } catch {}
    this.socket = null
    this.name = null
  }

  // ---- send/commands ----
  private send(data: any) {
    const s = this.socket
    if (!s || s.readyState !== WebSocket.OPEN) {
      this.outgoingQueue.push(data)
      return
    }
    s.send(JSON.stringify(data))
  }

  createProposal(p: Omit<Proposal, 'id'|'createdAt'|'status'|'comments'>) {
    this.send({ type: 'createProposal', payload: p })
  }
  vote(choice: VoteChoice) { this.send({ type: 'vote', choice }) }
  startSession() { this.send({ type: 'startSession' }) }
  tyrant(action: 'enforce'|'veto') { this.send({ type: 'tyrant', action }) }
  authorAdjust(proposalId: string, text: string, eventDate: string | null) {
    this.send({ type: 'authorAdjust', proposalId, text, eventDate })
  }
  updateSettings(settings: Partial<Settings>) {
    this.send({ type: 'updateSettings', settings })
  }
  editProposal(id: string, patch: Partial<Proposal>) {
    this.send({ type: 'editProposal', id, patch })
  }
  deleteProposal(id: string) { this.send({ type: 'deleteProposal', id }) }
  deleteUser(name: string) { this.send({ type: 'deleteUser', name }) }
}

// HMR-safe singleton
const KEY = '__FC_WS_SINGLETON__'
export const ws: WSService =
  (globalThis as any)[KEY] || ((globalThis as any)[KEY] = new WSService())

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ws.destroy()
    delete (globalThis as any)[KEY]
  })
}
