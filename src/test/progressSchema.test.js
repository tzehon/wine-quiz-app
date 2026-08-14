import { describe, expect, it } from 'vitest'
import {
  createDefaultProgress,
  normalizeSavedProgress,
  parseProgressImport,
  PROGRESS_SCHEMA_VERSION,
} from '../utils/progressSchema'

describe('progress schema migration', () => {
  it('creates a complete v2 progress record', () => {
    expect(createDefaultProgress()).toEqual(expect.objectContaining({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      wineProgress: {},
      categoryProgress: {},
      streakData: expect.objectContaining({ activityDates: [] }),
      stats: expect.objectContaining({
        trackedAccuracy: { correct: 0, answered: 0, startedAt: null },
        byMode: {},
        completedSessionIds: [],
      }),
    }))
  })

  it('migrates a legacy record without inventing historical accuracy', () => {
    const migrated = normalizeSavedProgress({
      wineProgress: {
        Riesling: {
          timesCorrect: 4,
          timesIncorrect: 2,
          interval: 6,
          lastSeen: '2026-08-10T00:00:00Z',
          studyStatus: 'known',
        },
      },
      streakData: {
        currentStreak: 3,
        longestStreak: 4,
        lastQuizDate: '2026-08-13',
      },
      stats: { totalQuizzes: 7, totalQuestions: 42 },
    })

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.wineProgress.Riesling).toEqual(expect.objectContaining({
      timesCorrect: 4,
      timesIncorrect: 2,
      studyStatus: 'known',
      repetitions: 2,
      lapses: 0,
      nextReview: null,
    }))
    expect(migrated.streakData.activityDates).toEqual(['2026-08-13'])
    expect(migrated.stats.totalQuestions).toBe(42)
    expect(migrated.stats.trackedAccuracy).toEqual({
      correct: 0,
      answered: 0,
      startedAt: null,
    })
  })

  it('normalizes v2 schedules, activity, accuracy, modes, and session IDs', () => {
    const normalized = normalizeSavedProgress({
      schemaVersion: 2,
      wineProgress: {
        Cava: {
          timesCorrect: 2.8,
          timesIncorrect: -1,
          interval: 6.9,
          repetitions: 2.7,
          lapses: 1.9,
          easeFactor: 2.3,
          nextReview: '2026-08-20T00:00:00Z',
        },
      },
      streakData: {
        lastQuizDate: '2026-08-13',
        activityDates: ['2026-08-12', '2026-08-13', '2026-02-30', 'invalid'],
      },
      stats: {
        trackedAccuracy: { correct: 12, answered: 8, startedAt: '2026-08-01' },
        byMode: {
          'quick-fire': { correct: 9, answered: 5 },
          unknown: { correct: 1, answered: 1 },
        },
        completedSessionIds: ['one', 'one', 2, 'two'],
      },
    })

    expect(normalized.wineProgress.Cava).toEqual(expect.objectContaining({
      timesCorrect: 2,
      timesIncorrect: 0,
      interval: 6,
      repetitions: 2,
      lapses: 1,
      easeFactor: 2.3,
    }))
    expect(normalized.streakData.activityDates).toEqual(['2026-08-12', '2026-08-13'])
    expect(normalized.stats.trackedAccuracy).toEqual({
      correct: 8,
      answered: 8,
      startedAt: '2026-08-01',
    })
    expect(normalized.stats.byMode).toEqual({
      'quick-fire': { correct: 5, answered: 5 },
    })
    expect(normalized.stats.completedSessionIds).toEqual(['one', 'two'])
  })

  it('rejects future schema versions and malformed imports', () => {
    expect(parseProgressImport(JSON.stringify({ schemaVersion: 999 }))).toBeNull()
    expect(parseProgressImport('[]')).toBeNull()
    expect(parseProgressImport('{bad')).toBeNull()
  })
})
