import type { Round } from './schedule'
import type { RoundPoints } from './scoring'
import { scoresForSchedule } from './scoring'

export type SharePayloadV1 = {
  v: 1
  names: string[]
  courts: number
  rounds: Round[]
}

export type SharePayloadV2 = {
  v: 2
  names: string[]
  courts: number
  rounds: Round[]
  roundScores: RoundPoints[]
  finalRound: Round | null
  finalScores: RoundPoints | null
}

export type SharePayload = SharePayloadV1 | SharePayloadV2

function utf8ToBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSharePayload(payload: SharePayloadV2): string {
  return utf8ToBase64Url(JSON.stringify(payload))
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
        typeof (row as MatchPointsLike).team1 === 'number' &&
        typeof (row as MatchPointsLike).team2 === 'number',
    )
  )
}

type MatchPointsLike = { team1: number; team2: number }

function isRound(x: unknown): x is Round {
  if (!x || typeof x !== 'object') return false
  const o = x as Round
  return Array.isArray(o.matches) && Array.isArray(o.sittingOut)
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const json = base64UrlToUtf8(encoded)
    const data = JSON.parse(json) as Record<string, unknown>
    if (data?.v === 1) {
      const names = data.names
      const courts = data.courts
      const rounds = data.rounds
      if (!Array.isArray(names) || typeof courts !== 'number' || !Array.isArray(rounds)) {
        return null
      }
      if (!rounds.every(isRound)) return null
      return {
        v: 1,
        names: names as string[],
        courts,
        rounds: rounds as Round[],
      }
    }
    if (data?.v === 2) {
      const names = data.names
      const courts = data.courts
      const rounds = data.rounds
      if (!Array.isArray(names) || typeof courts !== 'number' || !Array.isArray(rounds)) {
        return null
      }
      if (!rounds.every(isRound)) return null
      let roundScores = data.roundScores
      if (!Array.isArray(roundScores) || roundScores.length !== rounds.length) {
        roundScores = scoresForSchedule(rounds as Round[])
      } else if (!roundScores.every(isRoundPoints)) {
        return null
      }
      let finalRound: Round | null = null
      if (data.finalRound != null) {
        if (!isRound(data.finalRound)) return null
        finalRound = data.finalRound
      }
      let finalScores: RoundPoints | null = null
      if (data.finalScores != null) {
        if (!isRoundPoints(data.finalScores)) return null
        finalScores = data.finalScores
      }
      if (finalRound && finalScores) {
        if (finalScores.matches.length !== finalRound.matches.length) {
          finalScores = null
        }
      }
      return {
        v: 2,
        names: names as string[],
        courts,
        rounds: rounds as Round[],
        roundScores: roundScores as RoundPoints[],
        finalRound,
        finalScores,
      }
    }
    return null
  } catch {
    return null
  }
}

export function readShareFromLocation(): SharePayload | null {
  const params = new URLSearchParams(window.location.search)
  const d = params.get('d')
  if (!d) return null
  return decodeSharePayload(d)
}

export function buildShareUrl(payload: SharePayloadV2): string {
  const enc = encodeSharePayload(payload)
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('d', enc)
  return url.toString()
}

/** Normalize any decoded payload to v2 shape for app state. */
export function normalizeSharePayload(payload: SharePayload): SharePayloadV2 {
  if (payload.v === 2) {
    return payload
  }
  return {
    v: 2,
    names: payload.names,
    courts: payload.courts,
    rounds: payload.rounds,
    roundScores: scoresForSchedule(payload.rounds),
    finalRound: null,
    finalScores: null,
  }
}
