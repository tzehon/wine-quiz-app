import { describe, expect, it } from 'vitest'
import {
  buildActivityCalendar,
  getProgressSummary,
} from '../utils/progressMetrics'

const wineData = {
  styles: [
    {
      id: 'white',
      name: 'White Wine',
      color: '#fff4cc',
      wines: [
        { name: 'Alpha', origin: 'France' },
        { name: 'Beta', origin: 'Italy' },
        { name: 'Alpha', origin: 'France' },
      ],
    },
    {
      id: 'red',
      name: 'Red Wine',
      color: '#722f37',
      wines: [{ name: 'Gamma', origin: 'Spain' }],
    },
  ],
}

function localNoon(year, month, day) {
  return new Date(year, month - 1, day, 12)
}

describe('buildActivityCalendar', () => {
  it('builds an oldest-to-newest calendar from local date keys', () => {
    const calendar = buildActivityCalendar(
      ['2026-03-06', '2026-03-09', '2026-03-10', '2026-03-10', 'not-a-date', 42],
      localNoon(2026, 3, 10),
      5,
    )

    expect(calendar).toEqual([
      { date: '2026-03-06', day: 6, isActive: true, isToday: false },
      { date: '2026-03-07', day: 7, isActive: false, isToday: false },
      { date: '2026-03-08', day: 8, isActive: false, isToday: false },
      { date: '2026-03-09', day: 9, isActive: true, isToday: false },
      { date: '2026-03-10', day: 10, isActive: true, isToday: true },
    ])
  })

  it('handles leap-day and month boundaries using local calendar arithmetic', () => {
    expect(buildActivityCalendar(
      ['2024-02-29'],
      localNoon(2024, 3, 1),
      3,
    )).toEqual([
      { date: '2024-02-28', day: 28, isActive: false, isToday: false },
      { date: '2024-02-29', day: 29, isActive: true, isToday: false },
      { date: '2024-03-01', day: 1, isActive: false, isToday: true },
    ])
  })

  it('rejects invalid window sizes and dates', () => {
    expect(() => buildActivityCalendar([], localNoon(2026, 1, 1), 0))
      .toThrow('days must be a positive integer.')
    expect(() => buildActivityCalendar([], 'not-a-date', 30))
      .toThrow('now must be a valid date.')
  })
})

describe('getProgressSummary', () => {
  it('summarizes only catalog wines and uses tracked question accuracy', () => {
    const now = localNoon(2026, 5, 8)
    const nextDueAt = new Date(now.getTime() + 60_000).toISOString()
    const summary = getProgressSummary({
      wineProgress: {
        Alpha: {
          timesCorrect: 2,
          timesIncorrect: 1,
          nextReview: new Date(now.getTime() - 1_000).toISOString(),
        },
        Beta: {
          timesCorrect: 0,
          timesIncorrect: 0,
          studyStatus: 'needs-study',
          lastSeen: new Date(now.getTime() - 60_000).toISOString(),
          nextReview: nextDueAt,
        },
        Gamma: {
          timesCorrect: 0,
          timesIncorrect: 0,
          nextReview: 'invalid',
        },
        Orphan: {
          timesCorrect: 100,
          studyStatus: 'known',
          nextReview: new Date(now.getTime() - 60_000).toISOString(),
        },
      },
      stats: {
        totalQuestions: 10,
        trackedAccuracy: {
          correct: 3,
          answered: 4,
          startedAt: '2026-05-01',
        },
      },
      streakData: {
        activityDates: [
          '2026-05-01',
          '2026-05-02',
          '2026-05-03',
          '2026-05-06',
          '2026-05-07',
          '2026-05-08',
          '2026-05-09',
          'invalid',
        ],
      },
    }, wineData, now)

    expect(summary).toEqual({
      catalogTotal: 3,
      practicedCount: 2,
      dueWines: ['Alpha'],
      dueCount: 1,
      scheduledCount: 2,
      nextDueAt,
      accuracyPercent: 75,
      totalQuestions: 10,
      untrackedQuestionCount: 6,
      streak: { current: 3, longest: 3 },
      categoryCoverage: [
        {
          id: 'white',
          name: 'White Wine',
          color: '#fff4cc',
          practiced: 2,
          total: 2,
        },
        {
          id: 'red',
          name: 'Red Wine',
          color: '#722f37',
          practiced: 0,
          total: 1,
        },
      ],
    })
    expect(summary.categoryCoverage[0]).not.toHaveProperty('mastery')
  })

  it('counts a review scheduled exactly at now as due', () => {
    const now = localNoon(2026, 6, 15)
    const summary = getProgressSummary({
      wineProgress: {
        Gamma: {
          timesCorrect: 1,
          timesIncorrect: 0,
          nextReview: now.toISOString(),
        },
      },
    }, wineData, now)

    expect(summary.dueWines).toEqual(['Gamma'])
    expect(summary.dueCount).toBe(1)
    expect(summary.scheduledCount).toBe(1)
    expect(summary.nextDueAt).toBeNull()
  })

  it('selects the earliest future catalog review and tolerates malformed catalog entries', () => {
    const now = localNoon(2026, 6, 15)
    const soonestReview = new Date(now.getTime() + 60_000).toISOString()
    const mixedCatalog = {
      styles: [
        {
          id: 'first',
          name: 'First',
          wines: [
            { name: 'Shared' },
            { name: 'Later' },
            null,
          ],
        },
        {
          id: 'second',
          name: 'Second',
          wines: [
            { name: 'Shared' },
            { name: 'Sooner' },
          ],
        },
        { id: 'empty', name: 'Empty', wines: null },
        null,
      ],
    }

    const summary = getProgressSummary({
      wineProgress: {
        Shared: { timesCorrect: 1, nextReview: new Date(now.getTime() + 180_000).toISOString() },
        Later: { timesCorrect: 1, nextReview: soonestReview },
        Sooner: { timesCorrect: 1, nextReview: new Date(now.getTime() + 120_000).toISOString() },
      },
    }, mixedCatalog, now)

    expect(summary.catalogTotal).toBe(3)
    expect(summary.scheduledCount).toBe(3)
    expect(summary.nextDueAt).toBe(soonestReview)
    expect(summary.categoryCoverage).toEqual([
      expect.objectContaining({ id: 'first', total: 2 }),
      expect.objectContaining({ id: 'second', total: 2 }),
      expect.objectContaining({ id: 'empty', total: 0 }),
    ])
  })

  it('keeps a streak active through yesterday and ignores future activity', () => {
    const summary = getProgressSummary({
      streakData: {
        activityDates: [
          '2026-07-01',
          '2026-07-02',
          '2026-07-03',
          '2026-07-06',
          '2026-07-07',
          '2026-07-09',
        ],
      },
    }, wineData, localNoon(2026, 7, 8))

    expect(summary.streak).toEqual({ current: 2, longest: 3 })
  })

  it('preserves unverifiable legacy streak totals while the saved streak is active', () => {
    const summary = getProgressSummary({
      streakData: {
        currentStreak: 5,
        longestStreak: 9,
        lastQuizDate: '2026-07-07',
        activityDates: ['2026-07-07'],
      },
    }, wineData, localNoon(2026, 7, 8))

    expect(summary.streak).toEqual({ current: 5, longest: 9 })
  })

  it('uses the same attempted-wine rules as the due queue', () => {
    const summary = getProgressSummary({
      wineProgress: {
        Gamma: { lastSeen: 'not-a-date', nextReview: 'also-not-a-date' },
      },
    }, wineData, localNoon(2026, 7, 8))

    expect(summary.dueWines).toEqual([])
    expect(summary.dueCount).toBe(0)
    expect(summary.scheduledCount).toBe(0)
  })

  it('returns a zero-safe summary for missing progress and catalog data', () => {
    expect(getProgressSummary(null, null, localNoon(2026, 1, 1))).toEqual({
      catalogTotal: 0,
      practicedCount: 0,
      dueWines: [],
      dueCount: 0,
      scheduledCount: 0,
      nextDueAt: null,
      accuracyPercent: null,
      totalQuestions: 0,
      untrackedQuestionCount: 0,
      streak: { current: 0, longest: 0 },
      categoryCoverage: [],
    })
  })

  it('reports legacy questions as untracked and clamps malformed counters', () => {
    const summary = getProgressSummary({
      wineProgress: {
        Alpha: { timesCorrect: -1, timesIncorrect: Number.NaN, studyStatus: '' },
      },
      stats: {
        totalQuestions: 7.9,
        trackedAccuracy: { correct: 20, answered: 4.8 },
      },
      streakData: {
        activityDates: ['2026-02-30', '2026-03-01'],
      },
    }, wineData, localNoon(2026, 3, 3))

    expect(summary.practicedCount).toBe(0)
    expect(summary.totalQuestions).toBe(7)
    expect(summary.accuracyPercent).toBe(100)
    expect(summary.untrackedQuestionCount).toBe(3)
    expect(summary.streak).toEqual({ current: 0, longest: 1 })
  })
})
