import { describe, expect, it } from 'vitest'
import {
  activeCourtCount,
  generateSchedule,
  scheduleStats,
  type Match,
  type Round,
} from './schedule'

function playersInMatch(m: Match): number[] {
  return [...m.team1, ...m.team2]
}

function assertWellFormed(
  rounds: Round[],
  playerCount: number,
  courts: number,
) {
  const active = activeCourtCount(playerCount, courts)
  for (const round of rounds) {
    expect(round.matches).toHaveLength(active)
    const seen = new Set<number>()
    for (const m of round.matches) {
      const ps = playersInMatch(m)
      // four distinct, in range
      expect(new Set(ps).size).toBe(4)
      for (const p of ps) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThan(playerCount)
        expect(seen.has(p)).toBe(false)
        seen.add(p)
      }
    }
    for (const s of round.sittingOut) seen.add(s)
    // every player is either playing or sitting, exactly once
    expect(seen.size).toBe(playerCount)
    expect(round.sittingOut).toHaveLength(playerCount - active * 4)
  }
}

describe('activeCourtCount', () => {
  it('caps courts by available foursomes', () => {
    expect(activeCourtCount(4, 3)).toBe(1)
    expect(activeCourtCount(8, 3)).toBe(2)
    expect(activeCourtCount(12, 2)).toBe(2)
    expect(activeCourtCount(3, 1)).toBe(0)
  })
})

describe('generateSchedule', () => {
  it('rejects rosters that are too small', () => {
    expect(() => generateSchedule(3, 1, 5)).toThrow(/at least 4/i)
  })

  it('always produces well-formed rounds (randomized invariants)', () => {
    const cases: Array<[number, number, number]> = [
      [4, 1, 6],
      [5, 1, 6],
      [8, 2, 7],
      [9, 2, 5],
      [12, 3, 8],
      [13, 3, 6],
    ]
    for (const [players, courts, rounds] of cases) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const schedule = generateSchedule(players, courts, rounds)
        expect(schedule).toHaveLength(rounds)
        assertWellFormed(schedule, players, courts)
      }
    }
  })

  it('rotates the bench fairly when players exceed court slots', () => {
    // 5 players, 1 court => exactly one sits each round; over 5 rounds each sits once.
    const schedule = generateSchedule(5, 1, 5)
    expect(scheduleStats(5, schedule).sitOutSpread).toBeLessThanOrEqual(1)
  })

  it('avoids repeat partners when the round count allows it (4 players)', () => {
    // 4 players, 1 court, 3 rounds: the three distinct partnerships fit exactly.
    const schedule = generateSchedule(4, 1, 3)
    expect(scheduleStats(4, schedule).repeatPartners).toBe(0)
  })
})

describe('scheduleStats', () => {
  it('counts repeated partnerships', () => {
    const rounds: Round[] = [
      { matches: [{ team1: [0, 1], team2: [2, 3] }], sittingOut: [] },
      { matches: [{ team1: [0, 1], team2: [2, 3] }], sittingOut: [] },
    ]
    const stats = scheduleStats(4, rounds)
    // partnerships 0-1 and 2-3 each repeat once
    expect(stats.repeatPartners).toBe(2)
    // opponents 0-2,0-3,1-2,1-3 each repeat once
    expect(stats.repeatOpponents).toBe(4)
  })
})
