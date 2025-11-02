// src/utils/rankings.ts

export type UserScore = {
  name: string
  democracy?: number
  tyrant?: number
}

/**
 * Influence = total “impact points”.
 * We treat both Democracy and Tyrant as “influence” sources (just different styles),
 * so the ladder measures how much someone affects outcomes overall.
 */
export function influenceScore(u: UserScore): number {
  return (u.democracy || 0) + (u.tyrant || 0)
}

/**
 * Tier ladder — starts at 0 Influence and climbs to Ultimate Protector.
 * Feel free to tweak thresholds/titles/descriptions later.
 */
export const INFLUENCE_TIERS = [
  { min: 0,   title: 'Observer',            description: 'Getting started (0–19 influence)' },
  { min: 20,  title: 'Contributor',         description: 'Adds momentum (20–39)' },
  { min: 40,  title: 'Influencer',          description: 'Noticeable impact (40–59)' },
  { min: 60,  title: 'Guide',               description: 'Shaping decisions (60–79)' },
  { min: 80,  title: 'Guardian',            description: 'Reliable decision driver (80–99)' },
  { min: 100, title: 'Champion',            description: 'Leads direction (100–149)' },
  { min: 150, title: 'Protector',           description: 'Defines outcomes (150–199)' },
  { min: 200, title: 'Ultimate Protector',  description: 'Sets the standard (200+)' },
] as const

export function influenceTierIndex(score: number): number {
  let idx = 0
  for (let i = 0; i < INFLUENCE_TIERS.length; i++) {
    if (score >= INFLUENCE_TIERS[i].min) idx = i
  }
  return idx
}

// Combined ordered tiers from worst (index 0) to best (index 21). 20 points apart.
export const TIERS: Tier[] = [
  { title: 'Absolute Tyrant', description: 'Unquestionable ruler; every decision is made unilaterally, and dissent is crushed without mercy.' },
  { title: 'Despot', description: 'Rules with iron fists, controlling every aspect of life; heavy use of fear, violence, and manipulation to maintain power.' },
  { title: 'Autocrat', description: 'Holds supreme power but might employ more subtle tactics, using coercion and limited consultation with select advisors.' },
  { title: 'Dictator', description: 'Dominates through force or manipulation; may allow some institutions for show.' },
  { title: 'Supreme Leader', description: 'Almost absolute control; makes some concessions to public opinion or ritualized bodies.' },
  { title: 'Monarch', description: 'Often hereditary; substantial power via tradition; some limited consultation may exist.' },
  { title: 'Authoritarian', description: 'Strong central control with token democratic procedures.' },
  { title: 'Patriarch', description: 'Power through tradition, personal authority, or family loyalty; top-down structure.' },
  { title: 'High Chancellor', description: 'Significant power with an appearance of fairness or inclusivity.' },
  // Democratic side
  { title: 'Prime Minister', description: 'Leads via elected authority; subject to checks and balances.' },
  { title: 'Chancellor', description: 'Power via elections and coalitions; balances authority with democratic input.' },
  { title: 'Governor-General', description: 'Elected or appointed with some autonomy; often symbolic while representing institutions.' },
  { title: 'Senator', description: 'Works through collective decision-making; influence without absolute power.' },
  { title: 'Elected Leader', description: 'Broadly democratic; substantial input from the people.' },
  { title: 'Representative', description: 'Answers to a constituency; accountable to the public.' },
  { title: 'Magistrate', description: 'Selected through democratic/legal processes; focused on fairness and law.' },
  { title: 'Consul', description: 'Checks and balances with dual leadership; governance for the common good.' },
  { title: 'Tribune', description: 'Protects the interests of the common people; ensures their voice is heard.' },
  { title: 'Democratic Leader', description: 'Consent of the governed at the core; fully accountable.' },
  { title: 'People’s Champion', description: 'Servant-leader deeply committed to the welfare of the people.' },
  { title: 'President', description: 'Elected by the people; balances state needs and public will.' },
  { title: 'Councilor', description: 'Serves a council; gives equal voice to many interests.' }
]
