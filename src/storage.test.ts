import { afterEach, describe, expect, it } from 'vitest'
import {
  canUseLocalStorage,
  deleteSavedGroup,
  loadSavedGroups,
  upsertSavedGroup,
  type SavedGroup,
} from './storage'

const KEY = 'pickleball-mixer-saved-groups-v2'
const LEGACY_KEY = 'pickleball-mixer-saved-groups-v1'

afterEach(() => {
  localStorage.clear()
})

function group(overrides: Partial<SavedGroup> = {}): SavedGroup {
  return {
    id: 'id-1',
    name: 'Tuesday crew',
    players: ['Alex', 'Blake', 'Casey', 'Drew'],
    courts: 1,
    ...overrides,
  }
}

describe('canUseLocalStorage', () => {
  it('is true in the jsdom environment', () => {
    expect(canUseLocalStorage()).toBe(true)
  })
})

describe('upsert / load / delete', () => {
  it('saves and reloads a roster-only group', () => {
    expect(upsertSavedGroup(group())).toEqual({ ok: true })
    const loaded = loadSavedGroups()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Tuesday crew')
    expect(loaded[0].rounds).toBeUndefined()
  })

  it('updates in place when the id already exists', () => {
    upsertSavedGroup(group())
    upsertSavedGroup(group({ name: 'Renamed' }))
    const loaded = loadSavedGroups()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Renamed')
  })

  it('removes by id', () => {
    upsertSavedGroup(group())
    upsertSavedGroup(group({ id: 'id-2', name: 'Other' }))
    deleteSavedGroup('id-1')
    const loaded = loadSavedGroups()
    expect(loaded.map((g) => g.id)).toEqual(['id-2'])
  })
})

describe('sanitization', () => {
  it('drops entries with missing required fields', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        group(),
        { id: 'bad', name: 'no players' }, // missing players/courts
        { name: 'no id', players: [], courts: 1 },
      ]),
    )
    expect(loadSavedGroups()).toHaveLength(1)
  })

  it('returns [] for non-array junk', () => {
    localStorage.setItem(KEY, '{"not":"an array"}')
    expect(loadSavedGroups()).toEqual([])
  })
})

describe('legacy migration', () => {
  it('reads the v1 key when v2 is absent', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([group({ id: 'legacy' })]))
    const loaded = loadSavedGroups()
    expect(loaded.map((g) => g.id)).toEqual(['legacy'])
    // migrated forward to the v2 key
    expect(localStorage.getItem(KEY)).toBeTruthy()
  })
})
