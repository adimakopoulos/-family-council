// src/utils/rankings.ts
export type UserScore = { name: string; influence?: number }

export function influenceScore(u: UserScore): number {
  return Number(u.influence || 0)
}

// Keep your INFLUENCE_TIERS as you set earlier…
export const INFLUENCE_TIERS = [
  { min: 0,   title: 'Civic Newcomer',                           description: 'Learning the ropes; attends meetings and listens.' },
  { min: 10,  title: 'Registered Voter',                         description: 'Shows up at the ballot box; basic civic impact.' },
  { min: 20,  title: 'Campaign Volunteer',                       description: 'Knocks doors / phones banks; mobilizes neighbors.' },
  { min: 30,  title: 'Party Member',                             description: 'Participates in local party decisions and primaries.' },
  { min: 40,  title: 'Poll Worker / Election Steward',           description: 'Helps elections run fairly and smoothly.' },
  { min: 50,  title: 'Community Organizer',                      description: 'Builds local coalitions; turns issues into action.' },
  { min: 60,  title: 'Campaign Captain',                         description: 'Leads volunteers; sets field targets and tactics.' },
  { min: 70,  title: 'School Board Member',                      description: 'Direct influence over education policy and budget.' },
  { min: 80,  title: 'Municipal Councillor / City Councilor',    description: 'Writes local ordinances; approves city budgets.' },
  { min: 100, title: 'Mayor',                                    description: 'Executes city policy; sets local priorities and tone.' },
  { min: 120, title: 'County / Prefectural Councillor',          description: 'Regional services, land use, health, and transport.' },
  { min: 140, title: 'Regional Councillor',                      description: 'Allocates funds and sets policy across municipalities.' },
  { min: 160, title: 'Regional Governor / Prefect',              description: 'Leads a region; crisis response and development strategy.' },
  { min: 180, title: 'National Party Delegate',                  description: 'Influences party platforms, leadership, and slates.' },
  { min: 200, title: 'National Legislator (Lower House)',        description: 'Drafts laws; represents districts at the national level.' },
  { min: 230, title: 'Legislative Committee Member',             description: 'Shapes, amends, and advances bill text in committee.' },
  { min: 260, title: 'Committee Chair',                          description: 'Controls hearings, witnesses, and the committee agenda.' },
  { min: 290, title: 'Party Whip / Group Secretary',             description: 'Counts votes; enforces caucus discipline and strategy.' },
  { min: 320, title: 'National Legislator (Upper House / Senator)', description: 'Reviews policy; confirms appointments in many systems.' },
  { min: 350, title: 'Cabinet Minister / Secretary',             description: 'Leads a ministry; executes national policy portfolio.' },
  { min: 380, title: 'Deputy Prime Minister / Vice President',   description: 'Second-in-command; coalition broker and policy backstop.' },
  { min: 420, title: 'Speaker of the House / Parliament',        description: 'Controls floor time and legislative agenda pipeline.' },
  { min: 460, title: 'Prime Minister / Chancellor',              description: 'Heads government; directs national policy and cabinet.' },
  { min: 500, title: 'Head of State / President',                description: 'System-dependent powers; ultimate national figurehead or executive.' },
  { min: 560, title: 'Supranational Leader (e.g., EU/UN)',       description: 'Sets transnational agendas; coordinates across nations.' },
] as const

export function influenceTierIndex(score: number): number {
  let idx = 0
  for (let i = 0; i < INFLUENCE_TIERS.length; i++) {
    if (score >= INFLUENCE_TIERS[i].min) idx = i
  }
  return idx
}

// NEW: progress inside the current tier
export function tierProgress(score: number) {
  const idx = influenceTierIndex(score)
  const curr = INFLUENCE_TIERS[idx]
  const next = INFLUENCE_TIERS[idx + 1] || null
  const currMin = curr.min
  const nextMin = next ? next.min : curr.min + 50 // arbitrary span for last tier
  const span = Math.max(1, nextMin - currMin)
  const pct = Math.max(0, Math.min(1, (score - currMin) / span))
  const toNext = Math.max(0, nextMin - score)
  return { idx, curr, next, pct, toNext, currMin, nextMin }
}
