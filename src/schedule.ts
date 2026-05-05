/** Doubles match: team1 vs team2, player indices into roster. */
export type Match = {
  team1: [number, number]
  team2: [number, number]
}

export type Round = {
  matches: Match[]
  sittingOut: number[]
}

type Pair = [number, number]

function scoreMatch(m: Match, partner: number[][], opponent: number[][]): number {
  const [a, b] = m.team1
  const [c, d] = m.team2
  let s = partner[a][b] + partner[c][d]
  s += opponent[a][c] + opponent[a][d] + opponent[b][c] + opponent[b][d]
  return s
}

function scoreRound(matches: Match[], partner: number[][], opponent: number[][]): number {
  return matches.reduce((acc, m) => acc + scoreMatch(m, partner, opponent), 0)
}

function applyRound(
  matches: Match[],
  partner: number[][],
  opponent: number[][],
): void {
  for (const m of matches) {
    const [a, b] = m.team1
    const [c, d] = m.team2
    partner[a][b]++
    partner[b][a]++
    partner[c][d]++
    partner[d][c]++
    const opp: Pair[] = [
      [a, c],
      [a, d],
      [b, c],
      [b, d],
    ]
    for (const [x, y] of opp) {
      opponent[x][y]++
      opponent[y][x]++
    }
  }
}

/** All perfect matchings as disjoint pairs covering `players`. */
function allPerfectMatchings(players: number[]): Pair[][] {
  if (players.length % 2 !== 0) return []
  if (players.length === 0) return [[]]
  const sorted = [...players].sort((x, y) => x - y)
  const out: Pair[][] = []
  const first = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    const pair: Pair = [first, sorted[i]]
    const rest = sorted.filter((_, idx) => idx !== 0 && idx !== i)
    for (const tail of allPerfectMatchings(rest)) {
      out.push([pair, ...tail])
    }
  }
  return out
}

/** 4 players → 3 possible doubles games. */
function allMatchesFour(players: number[]): Match[] {
  const [p0, p1, p2, p3] = players
  return [
    { team1: [p0, p1], team2: [p2, p3] },
    { team1: [p0, p2], team2: [p1, p3] },
    { team1: [p0, p3], team2: [p1, p2] },
  ]
}

/** Split 4 pairs into 2 doubles matches (3 non-isomorphic ways). */
function twoGamesFromFourPairs(pairs: Pair[]): Match[][] {
  const [p0, p1, p2, p3] = pairs
  return [
    [
      { team1: p0, team2: p1 },
      { team1: p2, team2: p3 },
    ],
    [
      { team1: p0, team2: p2 },
      { team1: p1, team2: p3 },
    ],
    [
      { team1: p0, team2: p3 },
      { team1: p1, team2: p2 },
    ],
  ]
}

function bestRoundExact(
  playing: number[],
  activeCourts: number,
  partner: number[][],
  opponent: number[][],
): Match[] {
  const n = playing.length
  if (n !== activeCourts * 4) throw new Error('playing count mismatch')

  if (activeCourts === 1) {
    let best: Match | null = null
    let bestScore = Infinity
    for (const m of allMatchesFour(playing)) {
      const s = scoreMatch(m, partner, opponent)
      if (s < bestScore) {
        bestScore = s
        best = m
      }
    }
    return [best!]
  }

  if (activeCourts === 2) {
    let best: Match[] | null = null
    let bestScore = Infinity
    for (const matching of allPerfectMatchings(playing)) {
      for (const games of twoGamesFromFourPairs(matching)) {
        const s = scoreRound(games, partner, opponent)
        if (s < bestScore) {
          bestScore = s
          best = games
        }
      }
    }
    return best!
  }

  return bestRoundHeuristic(playing, activeCourts, partner, opponent, 900)
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function randomMatching(players: number[], rng: () => number): Pair[] {
  const p = [...players]
  shuffle(p, rng)
  const pairs: Pair[] = []
  for (let i = 0; i < p.length; i += 2) {
    pairs.push([p[i], p[i + 1]])
  }
  return pairs
}

/** Greedy assignment of pairings to courts for m >= 3. */
function matchingToGames(pairs: Pair[], rng: () => number): Match[] | null {
  const remaining = [...pairs]
  const games: Match[] = []
  while (remaining.length >= 2) {
    shuffle(remaining, rng)
    let found = false
    for (let i = 0; i < remaining.length && !found; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const a = remaining[i]
        const b = remaining[j]
        const verts = new Set([a[0], a[1], b[0], b[1]])
        if (verts.size === 4) {
          games.push({ team1: a, team2: b })
          remaining.splice(j, 1)
          remaining.splice(i, 1)
          found = true
          break
        }
      }
    }
    if (!found) return null
  }
  return games
}

function bestRoundHeuristic(
  playing: number[],
  activeCourts: number,
  partner: number[][],
  opponent: number[][],
  iterations: number,
): Match[] {
  const rng = Math.random
  let best: Match[] | null = null
  let bestScore = Infinity
  for (let t = 0; t < iterations; t++) {
    const pairs = randomMatching(playing, rng)
    const games = matchingToGames(pairs, rng)
    if (!games || games.length !== activeCourts) continue
    const s = scoreRound(games, partner, opponent)
    if (s < bestScore) {
      bestScore = s
      best = games
    }
  }
  if (!best) {
    const pairs = randomMatching(playing, rng)
    const sequential: Match[] = []
    for (let c = 0; c < activeCourts; c++) {
      sequential.push({
        team1: pairs[c * 2],
        team2: pairs[c * 2 + 1],
      })
    }
    return sequential
  }
  return best
}

function pickPlayingAndSitters(
  n: number,
  k: number,
  sitterCounts: number[],
): { playing: number[]; sitting: number[] } {
  if (n <= k) {
    return {
      playing: Array.from({ length: n }, (_, i) => i),
      sitting: [],
    }
  }
  const order = Array.from({ length: n }, (_, i) => i)
  order.sort((a, b) => sitterCounts[a] - sitterCounts[b] || Math.random() - 0.5)
  const sitting = order.slice(0, n - k)
  const playing = order.slice(n - k)
  for (const s of sitting) sitterCounts[s]++
  return { playing, sitting }
}

/**
 * Build a doubles mixer schedule. Minimizes repeat partners and repeat opponents
 * using exact search for 1–2 courts of play, heuristic beyond that.
 */
export function generateSchedule(
  playerCount: number,
  courts: number,
  roundCount: number,
): Round[] {
  if (playerCount < 4) {
    throw new Error('Need at least 4 players.')
  }
  const activeCourts = Math.min(courts, Math.floor(playerCount / 4))
  if (activeCourts < 1) {
    throw new Error('Not enough players for one doubles court (need 4).')
  }
  const k = activeCourts * 4
  const sitterCounts = new Array(playerCount).fill(0)
  const partner = Array.from({ length: playerCount }, () =>
    new Array(playerCount).fill(0),
  )
  const opponent = Array.from({ length: playerCount }, () =>
    new Array(playerCount).fill(0),
  )
  const rounds: Round[] = []

  for (let r = 0; r < roundCount; r++) {
    const { playing, sitting } = pickPlayingAndSitters(playerCount, k, sitterCounts)
    let matches: Match[]
    if (activeCourts <= 2) {
      matches = bestRoundExact(playing, activeCourts, partner, opponent)
    } else {
      matches = bestRoundHeuristic(playing, activeCourts, partner, opponent, 1200)
    }
    applyRound(matches, partner, opponent)
    rounds.push({ matches, sittingOut: sitting })
  }

  return rounds
}

export function activeCourtCount(playerCount: number, courts: number): number {
  return Math.min(courts, Math.floor(playerCount / 4))
}
