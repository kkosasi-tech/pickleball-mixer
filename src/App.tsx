import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  activeCourtCount,
  generateSchedule,
  type Match,
  type Round,
} from './schedule'
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
import {
  buildShareUrl,
  decodeSharePayload,
  normalizeSharePayload,
  readShareFromLocation,
  type SharePayloadV2,
} from './share'
import {
  deleteSavedGroup,
  loadSavedGroups,
  type SavedGroup,
  upsertSavedGroup,
} from './storage'

function maxPlayerIndexInSession(
  rounds: Round[],
  finalRound: Round | null,
): number {
  let m = -1
  const scanMatch = (match: Match) => {
    const [a, b] = match.team1
    const [c, d] = match.team2
    m = Math.max(m, a, b, c, d)
  }
  for (const r of rounds) {
    for (const match of r.matches) scanMatch(match)
    for (const s of r.sittingOut) m = Math.max(m, s)
  }
  if (finalRound) {
    for (const match of finalRound.matches) scanMatch(match)
  }
  return m
}
import './style.css'

function formatMatch(names: string[], m: Match): string {
  const t1 = `${names[m.team1[0]]} & ${names[m.team1[1]]}`
  const t2 = `${names[m.team2[0]]} & ${names[m.team2[1]]}`
  return `${t1} vs ${t2}`
}

function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parsePoints(raw: string): number {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

type StandingsProps = {
  title: string
  names: string[]
  totals: number[]
  hint?: string
}

function StandingsTable({ title, names, totals, hint }: StandingsProps) {
  const rows = standingsWithTies(totals)
  const topRank = rows[0]?.rank
  const leaders = rows.filter((r) => r.rank === topRank && r.points > 0)
  return (
    <div className="standings">
      <h3>{title}</h3>
      {hint && <p className="hint">{hint}</p>}
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.playerIndex}
              className={
                topRank !== undefined && r.rank === topRank ? 'leader' : ''
              }
            >
              <td>{r.rank}</td>
              <td>{names[r.playerIndex]}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {leaders.length > 0 && (
        <p className="leader-note">
          {leaders.length === 1 ? 'Leader' : 'Leaders'}:{' '}
          <strong>
            {leaders.map((x) => names[x.playerIndex]).join(', ')}
          </strong>{' '}
          ({leaders[0]!.points} pts)
        </p>
      )}
    </div>
  )
}

export default function App() {
  const [playerText, setPlayerText] = useState(
    ['Alex', 'Blake', 'Casey', 'Drew', 'Eden', 'Finn', 'Gray', 'Harper'].join(
      '\n',
    ),
  )
  const [courts, setCourts] = useState(2)
  const [roundCount, setRoundCount] = useState(7)
  const [schedule, setSchedule] = useState<Round[] | null>(null)
  const [roundScores, setRoundScores] = useState<RoundPoints[]>([])
  const [finalRound, setFinalRound] = useState<Round | null>(null)
  const [finalScores, setFinalScores] = useState<RoundPoints | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const [confirmDialog, setConfirmDialog] = useState<
    null | 'remove-championship' | 'rebuild-championship'
  >(null)

  const names = useMemo(() => parseNames(playerText), [playerText])
  const effectiveCourts = useMemo(
    () => activeCourtCount(names.length, courts),
    [names.length, courts],
  )

  const regularTotals = useMemo(
    () =>
      schedule && names.length >= 4
        ? computeRegularTotals(names.length, schedule, roundScores)
        : [],
    [schedule, names.length, roundScores],
  )

  const grandTotals = useMemo(
    () =>
      schedule && names.length >= 4
        ? computeTotals(
            names.length,
            schedule,
            roundScores,
            finalRound,
            finalScores,
          )
        : [],
    [schedule, names.length, roundScores, finalRound, finalScores],
  )

  const refreshSaved = useCallback(() => {
    setSavedGroups(loadSavedGroups())
  }, [])

  useEffect(() => {
    if (!confirmDialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDialog(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDialog])

  useEffect(() => {
    refreshSaved()
    const shared = readShareFromLocation()
    if (shared) {
      const p = normalizeSharePayload(shared)
      setPlayerText(p.names.join('\n'))
      setCourts(p.courts)
      setSchedule(p.rounds)
      setRoundCount(p.rounds.length || 7)
      setRoundScores(p.roundScores)
      setFinalRound(p.finalRound)
      setFinalScores(p.finalScores)
      setError(null)
    }
  }, [refreshSaved])

  const handleGenerate = () => {
    setError(null)
    setCopyHint(null)
    if (names.length < 4) {
      setError('Add at least four named players (one per line).')
      setSchedule(null)
      setRoundScores([])
      setFinalRound(null)
      setFinalScores(null)
      return
    }
    try {
      const rounds = generateSchedule(names.length, courts, roundCount)
      setSchedule(rounds)
      setRoundScores(scoresForSchedule(rounds))
      setFinalRound(null)
      setFinalScores(null)
    } catch (e) {
      setSchedule(null)
      setRoundScores([])
      setFinalRound(null)
      setFinalScores(null)
      setError(e instanceof Error ? e.message : 'Could not build schedule.')
    }
  }

  const updateRegularScore = (
    roundIdx: number,
    matchIdx: number,
    side: 'team1' | 'team2',
    value: string,
  ) => {
    setRoundScores((prev) => {
      const next = prev.map((r) => ({
        matches: r.matches.map((m) => ({ ...m })),
      }))
      if (!next[roundIdx]?.matches[matchIdx]) return prev
      next[roundIdx]!.matches[matchIdx]![side] = parsePoints(value)
      return next
    })
  }

  const updateFinalScore = (
    matchIdx: number,
    side: 'team1' | 'team2',
    value: string,
  ) => {
    if (!finalScores) return
    setFinalScores((prev) => {
      if (!prev) return prev
      const next: RoundPoints = {
        matches: prev.matches.map((m) => ({ ...m })),
      }
      if (!next.matches[matchIdx]) return prev
      next.matches[matchIdx]![side] = parsePoints(value)
      return next
    })
  }

  const setupChampionshipRoundFirstTime = () => {
    if (!schedule || names.length < 4) return
    if (finalRound) return
    setError(null)
    const reg = computeRegularTotals(names.length, schedule, roundScores)
    const ranked = rankPlayersByTotals(reg)
    const fr = buildChampionshipRound(ranked)
    setFinalRound(fr)
    setFinalScores(emptyRoundPoints(fr))
  }

  const executeRebuildChampionshipRound = () => {
    if (!schedule || names.length < 4) return
    setError(null)
    const reg = computeRegularTotals(names.length, schedule, roundScores)
    const ranked = rankPlayersByTotals(reg)
    const fr = buildChampionshipRound(ranked)
    setFinalRound(fr)
    setFinalScores(emptyRoundPoints(fr))
    setConfirmDialog(null)
  }

  const executeRemoveChampionshipRound = () => {
    setFinalRound(null)
    setFinalScores(null)
    setConfirmDialog(null)
  }

  const handleShare = async () => {
    if (!schedule || names.length === 0) {
      setError('Generate a schedule before sharing.')
      return
    }
    setError(null)
    const payload: SharePayloadV2 = {
      v: 2,
      names,
      courts,
      rounds: schedule,
      roundScores,
      finalRound,
      finalScores,
    }
    const url = buildShareUrl(payload)
    try {
      await navigator.clipboard.writeText(url)
      setCopyHint('Link copied. Paste it anywhere recipients can open it.')
    } catch {
      window.prompt('Copy this link:', url)
      setCopyHint(null)
    }
  }

  const handleSaveGroup = () => {
    if (names.length < 4) return
    const label = window.prompt(
      schedule
        ? 'Name for this saved session (roster, schedule, and scores on this device):'
        : 'Name for this roster (saved on this device). Generate a schedule first to include scores.',
    )
    if (!label?.trim()) return
    const group: SavedGroup = {
      id: crypto.randomUUID(),
      name: label.trim(),
      players: [...names],
      courts,
      savedAt: Date.now(),
    }
    if (schedule && schedule.length > 0) {
      group.rounds = schedule
      group.roundScores = roundScores
      group.finalRound = finalRound
      group.finalScores = finalScores
    }
    upsertSavedGroup(group)
    refreshSaved()
  }

  const handleLoadGroup = (id: string) => {
    const g = savedGroups.find((x) => x.id === id)
    if (!g) return
    setPlayerText(g.players.join('\n'))
    setCourts(g.courts)
    setError(null)
    setCopyHint(null)

    if (g.rounds && g.rounds.length > 0) {
      const n = g.players.length
      const maxIx = maxPlayerIndexInSession(g.rounds, g.finalRound ?? null)
      if (maxIx >= n) {
        setSchedule(null)
        setRoundScores([])
        setFinalRound(null)
        setFinalScores(null)
        setRoundCount(7)
        setError(
          'Saved schedule does not match this roster size; loaded names and courts only.',
        )
        return
      }
      setSchedule(g.rounds)
      setRoundCount(g.rounds.length)
      setRoundScores(
        g.roundScores && g.roundScores.length === g.rounds.length
          ? g.roundScores
          : scoresForSchedule(g.rounds),
      )
      const fr = g.finalRound ?? null
      setFinalRound(fr)
      setFinalScores(
        fr
          ? g.finalScores &&
            g.finalScores.matches.length === fr.matches.length
            ? g.finalScores
            : emptyRoundPoints(fr)
          : null,
      )
    } else {
      setSchedule(null)
      setRoundScores([])
      setFinalRound(null)
      setFinalScores(null)
      setRoundCount(7)
    }
  }

  const handleDeleteGroup = (id: string) => {
    deleteSavedGroup(id)
    refreshSaved()
  }

  const handleImportFromHash = () => {
    const raw = window.prompt('Paste a shared link or the ?d=… payload:')
    if (!raw?.trim()) return
    try {
      const u = new URL(raw.trim())
      const d = u.searchParams.get('d')
      if (d) {
        const data = decodeSharePayload(d)
        if (data) {
          const p = normalizeSharePayload(data)
          setPlayerText(p.names.join('\n'))
          setCourts(p.courts)
          setSchedule(p.rounds)
          setRoundCount(p.rounds.length || 7)
          setRoundScores(p.roundScores)
          setFinalRound(p.finalRound)
          setFinalScores(p.finalScores)
          setError(null)
          return
        }
      }
    } catch {
      /* not a full URL */
    }
    const data = decodeSharePayload(raw.trim())
    if (data) {
      const p = normalizeSharePayload(data)
      setPlayerText(p.names.join('\n'))
      setCourts(p.courts)
      setSchedule(p.rounds)
      setRoundCount(p.rounds.length || 7)
      setRoundScores(p.roundScores)
      setFinalRound(p.finalRound)
      setFinalScores(p.finalScores)
      setError(null)
    } else {
      setError('Could not read that link or payload.')
    }
  }

  const regularRows = standingsWithTies(regularTotals)
  const seedingSummary =
    schedule && names.length >= 4 ? (
      <ol className="seed-list">
        {regularRows.slice(0, Math.min(8, regularRows.length)).map((r) => (
          <li key={r.playerIndex}>
            {names[r.playerIndex]} — {r.points} pts (rank {r.rank})
          </li>
        ))}
      </ol>
    ) : null

  return (
    <div className="page">
      {confirmDialog && (
        <div
          className="modal-backdrop no-print"
          role="presentation"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-dialog-title">
              {confirmDialog === 'remove-championship'
                ? 'Remove championship?'
                : 'Rebuild championship matchups?'}
            </h3>
            <p className="modal-body">
              {confirmDialog === 'remove-championship'
                ? 'This removes the championship round and all final scores. Regular-round scores stay as they are.'
                : 'This replaces championship matchups using current standings and clears final scores. Regular-round scores stay the same.'}
            </p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                onClick={
                  confirmDialog === 'remove-championship'
                    ? executeRemoveChampionshipRound
                    : executeRebuildChampionshipRound
                }
              >
                {confirmDialog === 'remove-championship'
                  ? 'Remove championship'
                  : 'Rebuild'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="hero no-print">
        <h1>Pickleball mixer</h1>
        <p className="lede">
          Round-by-round doubles schedules with rotating partners. Enter each
          team’s game score every round; we add those points to each player’s
          running total. After regular play, seed a championship round (1st+4th
          vs 2nd+3rd, and 5th+8th vs 6th+7th when you have eight or more).
        </p>
      </header>

      <section className="panel no-print">
        <h2>Roster</h2>
        <label className="field">
          <span>Players (one per line)</span>
          <textarea
            value={playerText}
            onChange={(e) => setPlayerText(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder="Jamie&#10;Riley&#10;…"
          />
        </label>
        <p className="hint">
          {names.length} players · {effectiveCourts} court
          {effectiveCourts === 1 ? '' : 's'} in use
          {names.length > 0 && names.length < 4
            ? ' — add more players to start.'
            : ''}
          {names.length >= 4 && effectiveCourts < courts
            ? ` — only ${effectiveCourts} court(s) run until you have ${courts * 4} players.`
            : ''}
        </p>

        <div className="row">
          <label className="field tight">
            <span>Courts</span>
            <input
              type="number"
              min={1}
              max={8}
              value={courts}
              onChange={(e) => setCourts(Number(e.target.value) || 1)}
            />
          </label>
          <label className="field tight">
            <span>Rounds</span>
            <input
              type="number"
              min={1}
              max={50}
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value) || 1)}
            />
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        {copyHint && <p className="success">{copyHint}</p>}

        <div className="actions">
          <button type="button" className="primary" onClick={handleGenerate}>
            Generate schedule
          </button>
          <button
            type="button"
            onClick={() => {
              window.print()
            }}
            disabled={!schedule}
          >
            Print
          </button>
          <button type="button" onClick={handleShare} disabled={!schedule}>
            Copy share link
          </button>
        </div>

        <div className="saved no-print">
          <h3>Saved sessions (this browser)</h3>
          <p className="hint">
            Saves roster and courts; if you have generated a schedule, it also
            saves every round’s scores and the championship round. Load anytime
            to view or keep editing. Share links still work for sending to
            others.
          </p>
          <div className="row wrap">
            <button type="button" onClick={handleSaveGroup} disabled={names.length < 4}>
              Save (roster{schedule ? ' + schedule + scores' : ''})
            </button>
            <button type="button" onClick={handleImportFromHash}>
              Import from link
            </button>
            {savedGroups.length > 0 && (
              <label className="field tight">
                <span>Load</span>
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) handleLoadGroup(v)
                    e.target.value = ''
                  }}
                >
                  <option value="">Choose…</option>
                  {savedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.players.length}p, {g.courts}c
                      {g.rounds?.length
                        ? `, ${g.rounds.length} rnd`
                        : ''}
                      {g.finalRound ? ', final' : ''})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {savedGroups.length > 0 && (
            <ul className="saved-list">
              {savedGroups.map((g) => (
                <li key={g.id}>
                  <span>
                    <strong>{g.name}</strong> — {g.players.length} players,{' '}
                    {g.courts} court{g.courts === 1 ? '' : 's'}
                    {g.rounds?.length
                      ? `, ${g.rounds.length} rounds + scores`
                      : ', roster only'}
                    {g.finalRound ? ', championship' : ''}
                    {g.savedAt
                      ? ` · saved ${new Date(g.savedAt).toLocaleString()}`
                      : ''}
                  </span>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => handleDeleteGroup(g.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {schedule && names.length >= 4 && (
        <>
          <section className="standings-wrap print-area">
            <StandingsTable
              title="Live standings"
              names={names}
              totals={grandTotals}
              hint="Each player earns their team’s points each game. Bench rounds add 0. Championship points count once you enter them below."
            />
          </section>

          <section className="schedule print-area">
            <header className="print-header">
              <h2>Schedule & scoring</h2>
              <p className="meta">
                {names.length} players · {courts} court{courts === 1 ? '' : 's'}{' '}
                · {schedule.length} rounds
              </p>
            </header>
            <p className="scoring-help no-print">
              Enter the points each <strong>team</strong> scored in that game.
              Both partners receive that team total for the round.
            </p>
            <ol className="rounds">
              {schedule.map((round, ri) => {
                const pts = roundScores[ri] ?? emptyRoundPoints(round)
                return (
                  <li key={ri} className="round">
                    <h3>Round {ri + 1}</h3>
                    <ul className="courts">
                      {round.matches.map((m: Match, ci: number) => {
                        const row = pts.matches[ci] ?? { team1: 0, team2: 0 }
                        const t1n = `${names[m.team1[0]]} & ${names[m.team1[1]]}`
                        const t2n = `${names[m.team2[0]]} & ${names[m.team2[1]]}`
                        return (
                          <li key={ci} className="court-row">
                            <div className="court-main">
                              <span className="court-label">
                                Court {ci + 1}
                              </span>
                              <span className="match">
                                {formatMatch(names, m)}
                              </span>
                            </div>
                            <div className="score-inputs no-print">
                              <label>
                                <span className="sr-only">{t1n} score</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="score-box"
                                  value={row.team1}
                                  onChange={(e) =>
                                    updateRegularScore(
                                      ri,
                                      ci,
                                      'team1',
                                      e.target.value,
                                    )
                                  }
                                  aria-label={`Round ${ri + 1} court ${ci + 1}: ${t1n} points`}
                                />
                              </label>
                              <span className="score-sep">–</span>
                              <label>
                                <span className="sr-only">{t2n} score</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="score-box"
                                  value={row.team2}
                                  onChange={(e) =>
                                    updateRegularScore(
                                      ri,
                                      ci,
                                      'team2',
                                      e.target.value,
                                    )
                                  }
                                  aria-label={`Round ${ri + 1} court ${ci + 1}: ${t2n} points`}
                                />
                              </label>
                            </div>
                            <p className="score-print print-only">
                              Score: {row.team1} – {row.team2}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                    {round.sittingOut.length > 0 && (
                      <p className="bench">
                        Sitting out:{' '}
                        {round.sittingOut.map((i: number) => names[i]).join(', ')}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>

            <div className="finals">
              <h2>Championship round</h2>
              <p className="hint no-print">
                Matchups use <strong>regular-round</strong> totals (tiebreak:
                player order in roster). With 8+ players you get two games: top
                four and bottom four. With 4–7 players you get the top-four game
                only.
              </p>
              <div className="actions no-print">
                <button
                  type="button"
                  className="primary"
                  onClick={setupChampionshipRoundFirstTime}
                  disabled={!!finalRound}
                >
                  Set up championship round
                </button>
                {finalRound && (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmDialog('rebuild-championship')}
                    >
                      Rebuild matchups from standings
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDialog('remove-championship')}
                    >
                      Remove championship
                    </button>
                  </>
                )}
              </div>
              {finalRound && (
                <>
                  <h3>Seeding (regular points)</h3>
                  {seedingSummary}
                  <h3>Final games</h3>
                  <ul className="courts">
                    {finalRound.matches.map((m: Match, ci: number) => {
                      const fs = finalScores ?? emptyRoundPoints(finalRound)
                      const row = fs.matches[ci] ?? { team1: 0, team2: 0 }
                      const t1n = `${names[m.team1[0]]} & ${names[m.team1[1]]}`
                      const t2n = `${names[m.team2[0]]} & ${names[m.team2[1]]}`
                      return (
                        <li key={ci} className="court-row">
                          <div className="court-main">
                            <span className="court-label">
                              Final {ci + 1}
                            </span>
                            <span className="match">
                              {formatMatch(names, m)}
                            </span>
                          </div>
                          <div className="score-inputs no-print">
                            <label>
                              <input
                                type="number"
                                min={0}
                                className="score-box"
                                value={row.team1}
                                onChange={(e) =>
                                  updateFinalScore(ci, 'team1', e.target.value)
                                }
                                aria-label={`Final ${ci + 1}: ${t1n} points`}
                              />
                            </label>
                            <span className="score-sep">–</span>
                            <label>
                              <input
                                type="number"
                                min={0}
                                className="score-box"
                                value={row.team2}
                                onChange={(e) =>
                                  updateFinalScore(ci, 'team2', e.target.value)
                                }
                                aria-label={`Final ${ci + 1}: ${t2n} points`}
                              />
                            </label>
                          </div>
                          <p className="score-print print-only">
                            Score: {row.team1} – {row.team2}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>

            {finalRound && (
              <section className="podium print-area">
                <h2>Overall results</h2>
                <p className="hint">
                  Rankings use every regular game plus championship games. Ties
                  share the same rank; the next rank skips (1,2,2,4…).
                </p>
                <ol className="podium-list">
                  {standingsWithTies(grandTotals).map((r) => (
                    <li key={r.playerIndex}>
                      <span className="podium-rank">{r.rank}</span>
                      <span className="podium-name">
                        {names[r.playerIndex]}
                      </span>
                      <span className="podium-pts">{r.points} pts</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </section>
        </>
      )}
    </div>
  )
}
