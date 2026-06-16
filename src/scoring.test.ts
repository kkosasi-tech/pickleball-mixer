import { describe, expect, it } from 'vitest'
import type { Round } from './schedule'
import {
  buildChampionshipRound,
  computeRegularTotals,
  computeTotals,
  emptyRoundPoints,
  rankPlayersByTotals,
  scoresForSchedule,
  standingsWithTies,
  type RoundPoints,
} from './scoring'

// One round, one court: players 0&1 vs 2&3.
const round: Round = {
  matches: [{ team1: [0, 1], team2: [2, 3] }],
  sittingOut: [4],
}

describe('emptyRoundPoints / scoresForSchedule', () => {
  it('creates a zeroed row per match', () => {
    expect(emptyRoundPoints(round)).toEqual({
      matches: [{ team1: 0, team2: 0 }],
    })
  })

  it('mirrors the schedule shape', () => {
    const schedule = [round, round]
    expect(scoresForSchedule(schedule)).toHaveLength(2)
  })
})

describe('computeTotals', () => {
  it('awards each team total to both partners; bench gets 0', () => {
    const pts: RoundPoints = { matches: [{ team1: 11, team2: 7 }] }
    const totals = computeTotals(5, [round], [pts], null, null)
    expect(totals).toEqual([11, 11, 7, 7, 0])
  })

  it('clamps negative entered scores to 0', () => {
    const pts: RoundPoints = { matches: [{ team1: -5, team2: 3 }] }
    const totals = computeTotals(4, [round], [pts], null, null)
    expect(totals).toEqual([0, 0, 3, 3])
  })

  it('adds championship points on top of regular play', () => {
    const reg: RoundPoints = { matches: [{ team1: 10, team2: 2 }] }
    const finalRound: Round = {
      matches: [{ team1: [0, 2], team2: [1, 3] }],
      sittingOut: [],
    }
    const finalPts: RoundPoints = { matches: [{ team1: 5, team2: 1 }] }
    const totals = computeTotals(4, [round], [reg], finalRound, finalPts)
    // regular: 0,1 => 10 ; 2,3 => 2.  final: 0,2 => 5 ; 1,3 => 1
    expect(totals).toEqual([15, 11, 7, 3])
  })

  it('treats missing round scores as zero', () => {
    expect(computeTotals(4, [round], [], null, null)).toEqual([0, 0, 0, 0])
  })

  it('computeRegularTotals ignores finals', () => {
    const reg: RoundPoints = { matches: [{ team1: 4, team2: 6 }] }
    expect(computeRegularTotals(4, [round], [reg])).toEqual([4, 4, 6, 6])
  })
})

describe('rankPlayersByTotals', () => {
  it('orders best to worst, breaking ties by lower index', () => {
    expect(rankPlayersByTotals([3, 9, 9, 1])).toEqual([1, 2, 0, 3])
  })
})

describe('standingsWithTies', () => {
  it('uses competition ranking (1,2,2,4)', () => {
    const rows = standingsWithTies([10, 8, 8, 5])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4])
    expect(rows.map((r) => r.playerIndex)).toEqual([0, 1, 2, 3])
  })

  it('ranks every player when all are tied', () => {
    const rows = standingsWithTies([0, 0, 0])
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1])
  })
})

describe('buildChampionshipRound', () => {
  it('pairs 1st+4th vs 2nd+3rd for the top four', () => {
    const r = buildChampionshipRound([7, 3, 5, 9])
    expect(r.matches).toEqual([{ team1: [7, 9], team2: [3, 5] }])
  })

  it('adds a second game (5th+8th vs 6th+7th) for eight or more', () => {
    const r = buildChampionshipRound([0, 1, 2, 3, 4, 5, 6, 7])
    expect(r.matches).toEqual([
      { team1: [0, 3], team2: [1, 2] },
      { team1: [4, 7], team2: [5, 6] },
    ])
  })

  it('produces no match with fewer than four players', () => {
    expect(buildChampionshipRound([0, 1, 2]).matches).toEqual([])
  })
})
