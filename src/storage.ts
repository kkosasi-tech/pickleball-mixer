import type { Round } from './schedule'
import type { RoundPoints } from './scoring'
import { scoresForSchedule } from './scoring'

const KEY = 'pickleball-mixer-saved-groups-v2'
const LEGACY_KEY = 'pickleball-mixer-saved-groups-v1'

export type SavedGroup = {
  id: string
  name: string
  players: string[]
  courts: number
  /** Set when a schedule was saved with scores (or empty scores). */
  rounds?: Round[]
  roundScores?: RoundPoints[]
  finalRound?: Round | null
  finalScores?: RoundPoints | null
  savedAt?: number
}

function isRound(x: unknown): x is Round {
  if (!x || typeof x !== 'object') return false
  const o = x as Round
  return Array.isArray(o.matches) && Array.isArray(o.sittingOut)
}

function isRoundPoints(x: unknown): x is RoundPoints {
  if (!x || typeof x !== 'object') return false
  const m = (x as RoundPoints).matches
  return (
    Array.isArray(m) &&
    m.every(
      (row) =>
        row &&
        typeof row === 'object' &&
        typeof (row as { team1: unknown }).team1 === 'number' &&
        typeof (row as { team2: unknown }).team2 === 'number',
    )
  )
}

function sanitizeGroup(raw: unknown): SavedGroup | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Record<string, unknown>
  if (typeof g.id !== 'string' || typeof g.name !== 'string') return null
  if (!Array.isArray(g.players) || !g.players.every((p) => typeof p === 'string')) {
    return null
  }
  if (typeof g.courts !== 'number') return null

  const out: SavedGroup = {
    id: g.id,
    name: g.name,
    players: g.players,
    courts: g.courts,
  }
  if (typeof g.savedAt === 'number') out.savedAt = g.savedAt

  const rounds = g.rounds
  if (Array.isArray(rounds) && rounds.length > 0 && rounds.every(isRound)) {
    out.rounds = rounds as Round[]
    let rs = g.roundScores
    if (Array.isArray(rs) && rs.length === out.rounds.length && rs.every(isRoundPoints)) {
      out.roundScores = rs as RoundPoints[]
    } else {
      out.roundScores = scoresForSchedule(out.rounds)
    }
    if (g.finalRound != null && isRound(g.finalRound)) {
      out.finalRound = g.finalRound
    } else {
      out.finalRound = null
    }
    if (g.finalScores != null && isRoundPoints(g.finalScores)) {
      out.finalScores = g.finalScores
      if (out.finalRound && out.finalScores.matches.length !== out.finalRound.matches.length) {
        out.finalScores = null
      }
    } else {
      out.finalScores = null
    }
  }

  return out
}

export function loadSavedGroups(): SavedGroup[] {
  try {
    let raw = localStorage.getItem(KEY)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        localStorage.setItem(KEY, legacy)
        raw = legacy
      }
    }
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeGroup).filter((g): g is SavedGroup => g != null)
  } catch {
    return []
  }
}

export function persistSavedGroups(groups: SavedGroup[]): void {
  localStorage.setItem(KEY, JSON.stringify(groups))
}

export function upsertSavedGroup(group: SavedGroup): void {
  const all = loadSavedGroups()
  const idx = all.findIndex((g) => g.id === group.id)
  if (idx >= 0) all[idx] = group
  else all.push(group)
  persistSavedGroups(all)
}

export function deleteSavedGroup(id: string): void {
  persistSavedGroups(loadSavedGroups().filter((g) => g.id !== id))
}
