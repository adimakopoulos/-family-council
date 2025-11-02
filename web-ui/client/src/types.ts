export type VoteChoice = 'accept' | 'reject'

export type Comment = {
  author: string
  text: string
  timestamp: number
}

export type ProposalStatus = 'open' | 'passed' | 'rejected' | 'pending'

export interface Proposal {
  id: string
  title: string
  description: string
  voteDeadline: string
  eventDate?: string
  author: string
  status: ProposalStatus
  createdAt: number
  comments: ProposalComment[]
  stats?: {
    rounds: number
    totalVotingMs: number
    firstStartedAt: number
    resolvedAt?: number
  }
}

export type Session = {
  id: string
  proposalId: string
  startedAt: number
  durationSeconds: number
  votes: Record<string, 'accept' | 'reject'>
  attendees: string[]
  status: 'active' | 'ended'
  awaitingAuthorAdjust?: boolean
  reason?: string

  // NEW (optional for safety)
  votingSet?: string[]
  round?: number
}


export type User = {
  name: string
  influence: number
}

export type Settings = {
  requiredMembers: number
  countdownSeconds: number
  interludeSeconds: number
  preSessionSeconds: number   // new
}

export type ServerState = {
  proposals: Proposal[]
  users: Record<string, UserPoints>
  session?: Session | null
  settings: Settings
  live: string[]
}

export interface ProposalComment {
  author: string
  timestamp: number
  text?: string
  eventDate?: string // ISO string when author proposed a new date
}

export type You = { name: string, isAdmin: boolean }
