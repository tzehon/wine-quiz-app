import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSpacedRepetition } from '../hooks/useSpacedRepetition'
import {
  DAY_IN_MILLISECONDS,
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR,
  getSpacedRepetitionSummary,
  normalizeWineProgress,
  selectDueWines,
  updateWineSchedule,
} from '../utils/spacedRepetition'

const NOW = new Date('2026-08-14T12:00:00.000Z')

function isoDaysFromNow(days) {
  return new Date(NOW.getTime() + days * DAY_IN_MILLISECONDS).toISOString()
}

describe('normalizeWineProgress', () => {
  it('returns a complete default schedule for missing or malformed progress', () => {
    expect(normalizeWineProgress(null)).toEqual({
      timesCorrect: 0,
      timesIncorrect: 0,
      repetitions: 0,
      interval: 0,
      easeFactor: DEFAULT_EASE_FACTOR,
      lapses: 0,
      lastSeen: null,
      nextReview: null,
    })

    expect(normalizeWineProgress([])).toEqual(normalizeWineProgress(null))
  })

  it('normalizes counters, dates, and ease while preserving unrelated metadata', () => {
    expect(normalizeWineProgress({
      timesCorrect: 3.9,
      timesIncorrect: -1,
      repetitions: Number.NaN,
      interval: 2.8,
      easeFactor: 0.4,
      lapses: 1.9,
      lastSeen: '2026-08-01T00:00:00Z',
      nextReview: 'not-a-date',
      studyStatus: 'needs-study',
    })).toEqual({
      timesCorrect: 3,
      timesIncorrect: 0,
      repetitions: 2,
      interval: 2,
      easeFactor: MIN_EASE_FACTOR,
      lapses: 1,
      lastSeen: '2026-08-01T00:00:00.000Z',
      nextReview: null,
      studyStatus: 'needs-study',
    })
  })

  it('infers repetition stage for legacy schedules that lack repetitions', () => {
    expect(normalizeWineProgress({ interval: 0 }).repetitions).toBe(0)
    expect(normalizeWineProgress({ interval: 1 }).repetitions).toBe(1)
    expect(normalizeWineProgress({ interval: 6 }).repetitions).toBe(2)
  })
})

describe('updateWineSchedule', () => {
  it('uses the 1-day, 6-day, then rounded interval-times-ease sequence', () => {
    const first = updateWineSchedule(null, true, NOW)
    expect(first).toMatchObject({
      timesCorrect: 1,
      timesIncorrect: 0,
      repetitions: 1,
      interval: 1,
      easeFactor: DEFAULT_EASE_FACTOR,
      lapses: 0,
      lastSeen: NOW.toISOString(),
      nextReview: isoDaysFromNow(1),
    })

    const second = updateWineSchedule(first, true, NOW)
    expect(second).toMatchObject({
      timesCorrect: 2,
      repetitions: 2,
      interval: 6,
      nextReview: isoDaysFromNow(6),
    })

    const third = updateWineSchedule(second, true, NOW)
    expect(third).toMatchObject({
      timesCorrect: 3,
      repetitions: 3,
      interval: 15,
      nextReview: isoDaysFromNow(15),
    })

    expect(updateWineSchedule({ repetitions: 2, interval: 3, easeFactor: 1.8 }, true, NOW))
      .toMatchObject({ repetitions: 3, interval: 5, easeFactor: 1.8 })
  })

  it('resets a failed schedule, records a lapse, and clamps ease at 1.3', () => {
    const progress = {
      timesCorrect: 8,
      timesIncorrect: 2,
      repetitions: 5,
      interval: 30,
      easeFactor: 1.4,
      lapses: 2,
      studyStatus: 'learning',
    }

    expect(updateWineSchedule(progress, false, NOW)).toEqual({
      ...progress,
      timesIncorrect: 3,
      repetitions: 0,
      interval: 1,
      easeFactor: MIN_EASE_FACTOR,
      lapses: 3,
      lastSeen: NOW.toISOString(),
      nextReview: isoDaysFromNow(1),
    })
  })

  it('does not mutate input and rejects an invalid injected time', () => {
    const progress = {
      timesCorrect: 1,
      timesIncorrect: 0,
      repetitions: 1,
      interval: 1,
      easeFactor: 2.5,
      lapses: 0,
      lastSeen: '2026-08-01T00:00:00.000Z',
      nextReview: '2026-08-02T00:00:00.000Z',
    }
    const snapshot = structuredClone(progress)

    updateWineSchedule(progress, true, NOW)

    expect(progress).toEqual(snapshot)
    expect(() => updateWineSchedule(progress, true, 'invalid')).toThrow(TypeError)
  })
})

describe('selectDueWines', () => {
  it('includes attempted missing, invalid, past, and exactly-due schedules only', () => {
    const allWines = [
      { name: 'Past', origin: 'France' },
      { name: 'Missing', origin: 'Italy' },
      { name: 'Invalid', origin: 'Spain' },
      { name: 'Boundary', origin: 'Germany' },
      { name: 'Future', origin: 'Portugal' },
      { name: 'Unseen', origin: 'Austria' },
      { name: 'Past', origin: 'Duplicate ignored' },
    ]
    const wineProgress = {
      Past: { timesCorrect: 1, nextReview: isoDaysFromNow(-4), lastSeen: isoDaysFromNow(-5) },
      Missing: { timesIncorrect: 1, lastSeen: isoDaysFromNow(-13) },
      Invalid: { timesCorrect: 1, nextReview: 'invalid', lastSeen: isoDaysFromNow(-9) },
      Boundary: { timesCorrect: 1, nextReview: NOW.toISOString(), lastSeen: isoDaysFromNow(-1) },
      Future: { timesCorrect: 1, nextReview: isoDaysFromNow(1), lastSeen: isoDaysFromNow(-1) },
      Unseen: { timesCorrect: 0, timesIncorrect: 0, nextReview: isoDaysFromNow(-30) },
      Orphan: { timesCorrect: 99, nextReview: isoDaysFromNow(-99) },
    }

    const due = selectDueWines(wineProgress, allWines, NOW)

    expect(due.map(wine => wine.name)).toEqual([
      'Missing',
      'Invalid',
      'Past',
      'Boundary',
    ])
    expect(due.map(wine => wine.overdueDays)).toEqual([13, 9, 4, 0])
    expect(due.every(wine => wine.priority === 'due')).toBe(true)
  })

  it('breaks equal-overdue ties by lapses, oldest lastSeen, then wine name', () => {
    const allWines = ['Zulu', 'Bravo', 'Charlie', 'Alpha'].map(name => ({ name }))
    const shared = {
      timesCorrect: 1,
      nextReview: isoDaysFromNow(-2),
      lastSeen: isoDaysFromNow(-3),
    }
    const wineProgress = {
      Zulu: { ...shared, lapses: 0 },
      Bravo: { ...shared, lapses: 2, lastSeen: isoDaysFromNow(-4) },
      Charlie: { ...shared, lapses: 2 },
      Alpha: { ...shared, lapses: 2 },
    }

    expect(selectDueWines(wineProgress, allWines, NOW).map(wine => wine.name))
      .toEqual(['Bravo', 'Alpha', 'Charlie', 'Zulu'])
  })

  it('is zero-safe for malformed collections and requires a valid time', () => {
    expect(selectDueWines(null, null, NOW)).toEqual([])
    expect(() => selectDueWines({}, [], undefined)).toThrow(TypeError)
  })
})

describe('getSpacedRepetitionSummary', () => {
  it('counts only current catalog entries and separates due, scheduled, and unseen', () => {
    const allWines = [
      { name: 'Due' },
      { name: 'Scheduled' },
      { name: 'Unseen' },
    ]
    const wineProgress = {
      Due: { timesIncorrect: 1, nextReview: isoDaysFromNow(-1) },
      Scheduled: { timesCorrect: 1, nextReview: isoDaysFromNow(1) },
      Orphan: { timesCorrect: 1, nextReview: isoDaysFromNow(-20) },
    }

    expect(getSpacedRepetitionSummary(wineProgress, allWines, NOW)).toEqual({
      dueForReview: 1,
      scheduled: 1,
      unseen: 1,
      attempted: 2,
      total: 3,
      newWines: 1,
      mastered: 1,
    })
  })
})

describe('useSpacedRepetition', () => {
  it('is a deterministic thin wrapper with pure and legacy update callbacks', () => {
    const allWines = [{ name: 'Due' }, { name: 'Future' }, { name: 'Unseen' }]
    const wineProgress = {
      Due: { timesIncorrect: 1, nextReview: isoDaysFromNow(-1) },
      Future: { timesCorrect: 1, nextReview: isoDaysFromNow(1) },
    }

    const { result } = renderHook(() => useSpacedRepetition(
      wineProgress,
      allWines,
      { now: NOW },
    ))

    expect(result.current.winesDueForReview.map(wine => wine.name)).toEqual(['Due'])
    expect(result.current.dueWines).toBe(result.current.winesDueForReview)
    expect(result.current.getNextWine()).toMatchObject({ name: 'Due' })
    expect(result.current.getNextWine(['Due'])).toBeNull()
    expect(result.current.getStudyStats).toEqual(result.current.summary)
    expect(result.current.summary).toMatchObject({
      dueForReview: 1,
      scheduled: 1,
      unseen: 1,
      attempted: 2,
      total: 3,
    })

    expect(result.current.updateWineSchedule(null, true, NOW))
      .toMatchObject({ repetitions: 1, interval: 1, lastSeen: NOW.toISOString() })
    expect(result.current.calculateUpdatedProgress('Due', true, null, NOW))
      .toEqual(result.current.updateWineSchedule(null, true, NOW))
  })
})
