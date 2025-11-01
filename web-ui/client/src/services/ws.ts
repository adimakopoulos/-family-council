import { ServerState, You, Proposal, VoteChoice, Settings } from '../types'

type Listener = (s: Partial<ServerState>) => void
type LiveListener = (l: string[]) => void
type SessionListener = (s: ServerState['session']) => void
type SoundListener = (kind: 'pass' | 'reject') => void
type YouListener = (y: You) => void
type ReminderListener = (at: number, title: string) => void
type InterludeListener = (p: { seconds: number; text: string }) => void
type PreSessionListener = (p: { seconds: number; text: string }) => void
type EndingListener = (s: any) => void


class WSService {
  ws?: WebSocket
  // NEW: queue for messages while CONNECTING / RECONNECTING
  outgoingQueue: any[] = []

  listeners: Listener[] = []
  liveListeners: LiveListener[] = []
  sessionListeners: SessionListener[] = []
  soundListeners: SoundListener[] = []
  youListeners: YouListener[] = []
  reminderListeners: ReminderListener[] = []
  interludeListeners: InterludeListener[] = []
  preSessionListeners: PreSessionListener[] = []
  endingListeners: EndingListener[] = []
  onPreSession(cb: PreSessionListener) { this.preSessionListeners.push(cb) }
  onEnding(cb: EndingListener) { this.endingListeners.push(cb) }



  state: ServerState | null = null
  you: You | null = null

  connect(name: string) {
    const url =
      (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':3001'
    const socket = new WebSocket(url)
    this.ws = socket

    socket.onopen = () => {
      // Send hello on THIS exact socket
      socket.send(JSON.stringify({ type: 'hello', name }))
      // Flush any queued messages through THIS socket
      while (this.outgoingQueue.length) {
        const data = this.outgoingQueue.shift()
        try { socket.send(JSON.stringify(data)) } catch {}
      }
    }

    socket.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'welcome') {
        this.state = msg.state
        this.you = msg.you
        this.youListeners.forEach(cb => cb(this.you!))
        this.listeners.forEach(cb => cb(this.state!))
      } else if (msg.type === 'state') {
        this.state = { ...(this.state || {}), ...msg.patch }
        this.listeners.forEach(cb => cb(msg.patch))
      } else if (msg.type === 'live') {
        this.liveListeners.forEach(cb => cb(msg.live))
      } else if (msg.type === 'session') {
        if (!this.state) this.state = {} as any
        // treat ended sessions as "no session"
        const nextSession = msg.session && msg.session.status === 'active' ? msg.session : null
        this.state.session = nextSession
        this.sessionListeners.forEach(cb => cb(nextSession))
      } else if (msg.type === 'sound') {
        this.soundListeners.forEach(cb => cb(msg.kind))
      } else if (msg.type === 'reminder') {
        this.reminderListeners.forEach(cb => cb(msg.at, msg.title))
      } else if (msg.type === 'toast') {
        alert(msg.text)
      } else if (msg.type === 'interlude') {
        this.interludeListeners.forEach(cb => cb({ seconds: msg.seconds, text: msg.text }))
      } else if (msg.type === 'preSession') {
        this.preSessionListeners.forEach(cb => cb({ seconds: msg.seconds, text: msg.text }))
      } else if (msg.type === 'ending') {
        this.endingListeners.forEach(cb => cb(msg.summary))
      }

    }

    socket.onclose = () => {
      // try to reconnect
      setTimeout(() => this.connect(name), 800)
    }
  }

  onState(cb: Listener) { this.listeners.push(cb) }
  onLive(cb: LiveListener) { this.liveListeners.push(cb) }
  onSession(cb: SessionListener) { this.sessionListeners.push(cb) }
  onSound(cb: SoundListener) { this.soundListeners.push(cb) }
  onYou(cb: YouListener) { this.youListeners.push(cb) }
  onReminder(cb: ReminderListener) { this.reminderListeners.push(cb) }
  onInterlude(cb: InterludeListener) { this.interludeListeners.push(cb) }

  // NEW: queue while not OPEN
  send(data: any) {
    const s = this.ws
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
  deleteProposal(id: string) {
    this.send({ type: 'deleteProposal', id })
  }
  deleteUser(name: string) {
    this.send({ type: 'deleteUser', name })
  }
}

export const ws = new WSService()
