import { describe, expect, it } from 'vitest'
import type { Round } from './schedule'
import type { RoundPoints } from './scoring'
import {
  buildShareUrl,
  decodeSharePayload,
  encodeSharePayload,
  normalizeSharePayload,
  readShareFromLocation,
  type SharePayloadV2,
} from './share'

const rounds: Round[] = [
  { matches: [{ team1: [0, 1], team2: [2, 3] }], sittingOut: [] },
]
const roundScores: RoundPoints[] = [{ matches: [{ team1: 11, team2: 9 }] }]

const payload: SharePayloadV2 = {
  v: 2,
  names: ['Alex', 'Blake', 'Casey', 'Drew'],
  courts: 1,
  rounds,
  roundScores,
  finalRound: null,
  finalScores: null,
}

describe('encode/decode round trip', () => {
  it('survives a full v2 round trip', () => {
    const decoded = decodeSharePayload(encodeSharePayload(payload))
    expect(decoded).toEqual(payload)
  })

  it('round-trips unicode names', () => {
    const p = { ...payload, names: ['Renée', '李雷', '🏓 Pat', 'Zoë'] }
    const decoded = decodeSharePayload(encodeSharePayload(p))
    expect(decoded?.names).toEqual(p.names)
  })

  it('returns null for garbage input', () => {
    expect(decodeSharePayload('not-base64-$$$')).toBeNull()
    expect(decodeSharePayload('')).toBeNull()
  })

  it('returns null when required fields are malformed', () => {
    const bad = btoa(
      JSON.stringify({ v: 2, names: 'nope', courts: 1, rounds: [] }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeSharePayload(bad)).toBeNull()
  })
})

describe('normalizeSharePayload', () => {
  it('upgrades a v1 payload to v2 with empty scores', () => {
    const v1 = encodeSharePayload({
      ...payload,
    })
    // hand-build a v1 by decoding then stripping — simpler: normalize a v1 object
    const normalized = normalizeSharePayload({
      v: 1,
      names: payload.names,
      courts: payload.courts,
      rounds,
    })
    expect(normalized.v).toBe(2)
    expect(normalized.roundScores).toHaveLength(rounds.length)
    expect(normalized.roundScores[0]).toEqual({
      matches: [{ team1: 0, team2: 0 }],
    })
    expect(normalized.finalRound).toBeNull()
    // sanity: v1 still encodes/decodes
    expect(decodeSharePayload(v1)).not.toBeNull()
  })
})

describe('location helpers (jsdom)', () => {
  it('builds a URL whose payload decodes back', () => {
    const url = buildShareUrl(payload)
    const d = new URL(url).searchParams.get('d')
    expect(d).toBeTruthy()
    expect(decodeSharePayload(d!)).toEqual(payload)
  })

  it('reads the payload from window.location', () => {
    const url = buildShareUrl(payload)
    window.history.replaceState({}, '', url)
    expect(readShareFromLocation()).toEqual(payload)
    window.history.replaceState({}, '', '/')
    expect(readShareFromLocation()).toBeNull()
  })
})
