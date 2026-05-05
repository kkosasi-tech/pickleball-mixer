import type { Match, Round } from './schedule'

/** Points each team scored in a doubles game for one match. */
export type MatchPoints = { team1: number; team2: number }

export type RoundPoints = { matches: MatchPoints[] }

export function emptyRoundPoints(round: Round): RoundPoints {
  return {
    matches: round.matches.map(() => ({ team1: 0, team2: 0 })),
  }
}

export function scoresForSchedule(schedule: Round[]): RoundPoints[] {
  return schedule.map((r) => emptyRoundPoints(r))
}

function addPointsForRound(
  totals: number[],
  round: Round,
  pts: RoundPoints,
): void {
  for (let i = 0; i < round.matches.length; i++) {
    const m = round.matches[i]
    const row = pts.matches[i]
    const team1 = Math.max(0, row?.team1 ?? 0)
    const team2 = Math.max(0, row?.team2 ?? 0)
    const [a, b] = m.team1
    const [c, d] = m.team2
    totals[a] += team1
    totals[b] += team1
    totals[c] += team2
    totals[d] += team2
  }
}

/** Cumulative points per player index (regular + optional finals). */
export function computeTotals(
  playerCount: number,
  rounds: Round[],
  roundPoints: RoundPoints[],
  finalRound: Round | null,
  finalPts: RoundPoints | null,
): number[] {
  const totals = new Array(playerCount).fill(0)
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r]
    const pts =
      roundPoints[r] ?? emptyRoundPoints(round)
    addPointsForRound(totals, round, pts)
  }
  if (finalRound && finalPts) {
    addPointsForRound(totals, finalRound, finalPts)
  }
  return totals
}

/** Totals from regular rounds only (used to seed finals). */
export function computeRegularTotals(
  playerCount: number,
  rounds: Round[],
  roundPoints: RoundPoints[],
): number[] {
  return computeTotals(playerCount, rounds, roundPoints, null, null)
}

/** Player indices sorted best → worst (tiebreak: lower index wins). */
export function rankPlayersByTotals(totals: number[]): number[] {
  const idx = totals.map((t, i) => ({ i, t }))
  idx.sort((a, b) => b.t - a.t || a.i - b.i)
  return idx.map((x) => x.i)
}

/**
 * Championship round from overall standing (indices in `ranked` are player indices,
 * ordered 1st → last).
 * - Top 4: 1st+4th vs 2nd+3rd
 * - If at least 8 in field: 5th+8th vs 6th+7th
 */
export function buildChampionshipRound(rankedPlayerIndices: number[]): Round {
  const matches: Match[] = []
  if (rankedPlayerIndices.length >= 4) {
    const [a, b, c, d] = rankedPlayerIndices
    matches.push({ team1: [a, d], team2: [b, c] })
  }
  if (rankedPlayerIndices.length >= 8) {
    const [, , , , e, f, g, h] = rankedPlayerIndices
    matches.push({ team1: [e, h], team2: [f, g] })
  }
  return { matches, sittingOut: [] }
}

export type StandingsRow = {
  rank: number
  playerIndex: number
  points: number
}

/** Competition ranking (1,2,2,4…) by total points. */
export function standingsWithTies(totals: number[]): StandingsRow[] {
  const order = rankPlayersByTotals(totals)
  const rows: StandingsRow[] = []
  for (let p = 0; p < order.length; p++) {
    const playerIndex = order[p]
    const points = totals[playerIndex]
    const rank =
      p > 0 && totals[order[p - 1]] === points ? rows[p - 1]!.rank : p + 1
    rows.push({ rank, playerIndex, points })
  }
  return rows
}
