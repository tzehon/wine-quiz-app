import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProgress } from '../hooks/useProgress'
import { DEFAULT_QUIZ_MODE_IDS } from '../quiz/quizModes'

describe('useProgress quiz settings migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts with only implemented quiz modes', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.progress.settings.enabledModes).toEqual(DEFAULT_QUIZ_MODE_IDS)
    expect(result.current.progress.settings.enabledModes).not.toContain('pronunciation')
  })

  it('removes the legacy pronunciation mode while preserving valid preferences', () => {
    localStorage.setItem('wineQuizProgress', JSON.stringify({
      settings: {
        enabledModes: ['pronunciation', 'quick-fire', 'origin-match', 'quick-fire'],
        darkMode: true,
      },
    }))

    const { result } = renderHook(() => useProgress())

    expect(result.current.progress.settings.enabledModes).toEqual(['quick-fire', 'origin-match'])
    expect(result.current.progress.settings.darkMode).toBe(true)
    expect(result.current.progress.settings.difficulty).toBe('medium')
    expect(result.current.progress.streakData).toEqual(expect.objectContaining({
      currentStreak: 0,
      longestStreak: 0,
    }))
  })

  it('falls back to all implemented modes when a legacy selection has no valid modes', () => {
    localStorage.setItem('wineQuizProgress', JSON.stringify({
      settings: { enabledModes: ['pronunciation', 'unknown-mode'] },
    }))

    const { result } = renderHook(() => useProgress())
    expect(result.current.progress.settings.enabledModes).toEqual(DEFAULT_QUIZ_MODE_IDS)
  })

  it('sanitizes mode updates and imports without dropping nested defaults', async () => {
    const { result } = renderHook(() => useProgress())

    act(() => {
      result.current.updateSettings({ enabledModes: ['quick-fire', 'pronunciation'] })
    })
    expect(result.current.progress.settings.enabledModes).toEqual(['quick-fire'])

    let importResult
    act(() => {
      importResult = result.current.importProgress(JSON.stringify({
        settings: {
          enabledModes: ['origin-match', 'pronunciation'],
          questionsPerSession: 20,
        },
      }))
    })

    expect(importResult).toBe(true)
    expect(result.current.progress.settings).toEqual(expect.objectContaining({
      enabledModes: ['origin-match'],
      questionsPerSession: 20,
      difficulty: 'medium',
      darkMode: false,
    }))

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('wineQuizProgress')).settings.enabledModes)
        .toEqual(['origin-match'])
    })
  })

  it('rejects non-object imports without replacing current progress', () => {
    const { result } = renderHook(() => useProgress())
    const before = result.current.progress

    let importResult
    act(() => {
      importResult = result.current.importProgress('[]')
    })

    expect(importResult).toBe(false)
    expect(result.current.progress).toBe(before)
  })

  it('rejects a future schema import without replacing current progress', () => {
    const { result } = renderHook(() => useProgress())
    const before = result.current.progress

    let importResult
    act(() => {
      importResult = result.current.importProgress(JSON.stringify({ schemaVersion: 999 }))
    })

    expect(importResult).toBe(false)
    expect(result.current.progress).toBe(before)
  })

  it('does not overwrite progress saved by a future app version on startup', () => {
    const futureSave = JSON.stringify({
      schemaVersion: 999,
      futureOnlyData: { keep: 'untouched' },
    })
    localStorage.setItem('wineQuizProgress', futureSave)

    const { result } = renderHook(() => useProgress())

    expect(result.current.progress.schemaVersion).toBe(2)
    expect(result.current.isReadOnly).toBe(true)
    expect(localStorage.getItem('wineQuizProgress')).toBe(futureSave)

    act(() => result.current.toggleDarkMode())
    expect(result.current.progress.settings.darkMode).toBe(false)
    expect(localStorage.getItem('wineQuizProgress')).toBe(futureSave)
  })

  it('does not overwrite a future save written after this app mounts', async () => {
    const { result } = renderHook(() => useProgress())
    const futureSave = JSON.stringify({ schemaVersion: 999, futureOnlyData: true })

    localStorage.setItem('wineQuizProgress', futureSave)
    act(() => result.current.toggleDarkMode())

    await waitFor(() => expect(result.current.isReadOnly).toBe(true))
    expect(localStorage.getItem('wineQuizProgress')).toBe(futureSave)
  })

  it('rechecks storage at persistence time before writing queued state', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProgress())
    const futureSave = JSON.stringify({ schemaVersion: 999, writtenDuringRace: true })

    act(() => result.current.toggleDarkMode())
    localStorage.setItem('wineQuizProgress', futureSave)
    await act(async () => vi.runOnlyPendingTimersAsync())

    expect(result.current.isReadOnly).toBe(true)
    expect(localStorage.getItem('wineQuizProgress')).toBe(futureSave)
  })

  it('switches to read-only when another tab writes future progress', async () => {
    const { result } = renderHook(() => useProgress())
    const futureSave = JSON.stringify({ schemaVersion: 999, futureOnlyData: true })
    localStorage.setItem('wineQuizProgress', futureSave)

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'wineQuizProgress',
        newValue: futureSave,
      }))
    })

    await waitFor(() => expect(result.current.isReadOnly).toBe(true))
    expect(localStorage.getItem('wineQuizProgress')).toBe(futureSave)
  })

  it('can reset a protected future save into a fresh writable record', async () => {
    localStorage.setItem('wineQuizProgress', JSON.stringify({ schemaVersion: 999 }))
    const { result } = renderHook(() => useProgress())

    act(() => result.current.resetProgress())

    await waitFor(() => expect(result.current.isReadOnly).toBe(false))
    expect(JSON.parse(localStorage.getItem('wineQuizProgress')).schemaVersion).toBe(2)
  })

  it('recovers from corrupt saved and imported JSON', () => {
    localStorage.setItem('wineQuizProgress', '{not-json')
    const { result } = renderHook(() => useProgress())

    expect(result.current.progress.settings.enabledModes).toEqual(DEFAULT_QUIZ_MODE_IDS)

    let importResult
    act(() => {
      importResult = result.current.importProgress('{still-not-json')
    })
    expect(importResult).toBe(false)
  })

  it('normalizes malformed nested records and bounded settings on import', () => {
    const { result } = renderHook(() => useProgress())

    let importResult
    act(() => {
      importResult = result.current.importProgress(JSON.stringify({
        wineProgress: {
          Riesling: {
            timesCorrect: '9',
            timesIncorrect: -2,
            lastSeen: 123,
            easeFactor: 'fast',
          },
          Broken: 'not-a-record',
        },
        categoryProgress: {
          'aromatic-white': { timesCorrect: '3', timesIncorrect: Infinity },
        },
        streakData: { currentStreak: '7', longestStreak: -1, lastQuizDate: 42 },
        settings: {
          difficulty: 'constructor',
          questionsPerSession: 1_000_000,
          darkMode: 'yes',
          focusCategories: ['rose', 12, 'rose'],
        },
        stats: { totalQuizzes: '4', totalQuestions: -5 },
      }))
    })

    expect(importResult).toBe(true)
    expect(result.current.progress.wineProgress).toEqual({
      Riesling: expect.objectContaining({
        timesCorrect: 0,
        timesIncorrect: 0,
        lastSeen: null,
        nextReview: null,
        easeFactor: 2.5,
      }),
    })
    expect(result.current.progress.categoryProgress['aromatic-white']).toEqual(expect.objectContaining({
      timesCorrect: 0,
      timesIncorrect: 0,
    }))
    expect(result.current.progress.streakData).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastQuizDate: null,
      activityDates: [],
    })
    expect(result.current.progress.settings).toEqual(expect.objectContaining({
      difficulty: 'medium',
      questionsPerSession: 10,
      darkMode: false,
      focusCategories: ['rose'],
    }))
    expect(result.current.progress.stats).toEqual(expect.objectContaining({
      totalQuizzes: 0,
      totalQuestions: 0,
    }))
  })

  it('records wine, category, and question counters without dropping existing state', () => {
    const { result } = renderHook(() => useProgress())

    act(() => {
      result.current.recordQuizAnswer({
        mode: 'category-match',
        isCorrect: true,
        answeredAt: '2026-08-14T00:00:00Z',
        wineResults: [{ wineName: 'Riesling', isCorrect: true }],
        categoryResults: [{ categoryId: 'aromatic-white', isCorrect: true }],
      })
      result.current.recordQuizAnswer({
        mode: 'category-match',
        isCorrect: false,
        answeredAt: '2026-08-14T00:01:00Z',
        wineResults: [{ wineName: 'Riesling', isCorrect: false }],
        categoryResults: [{ categoryId: 'aromatic-white', isCorrect: false }],
      })
    })

    expect(result.current.progress.wineProgress.Riesling).toEqual(expect.objectContaining({
      timesCorrect: 1,
      timesIncorrect: 1,
      lastSeen: expect.any(String),
      easeFactor: 2.3,
    }))
    expect(result.current.progress.categoryProgress['aromatic-white']).toEqual({
      timesCorrect: 1,
      timesIncorrect: 1,
    })
    expect(result.current.progress.stats.totalQuestions).toBe(2)
    expect(result.current.progress.stats.trackedAccuracy).toEqual({
      correct: 1,
      answered: 2,
      startedAt: '2026-08-14T00:00:00.000Z',
    })
  })

  it('persists an atomic review answer and schedule across a reload', async () => {
    const firstRender = renderHook(() => useProgress())

    act(() => {
      firstRender.result.current.recordQuizAnswer({
        mode: 'category-match',
        isCorrect: true,
        answeredAt: '2026-08-14T00:00:00Z',
        wineResults: [{ wineName: 'Cava', isCorrect: true }],
        categoryResults: [{ categoryId: 'sparkling', isCorrect: true }],
      })
    })

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('wineQuizProgress')).wineProgress.Cava.nextReview)
        .toBe('2026-08-15T00:00:00.000Z')
    })
    firstRender.unmount()

    const reloaded = renderHook(() => useProgress())
    expect(reloaded.result.current.progress.wineProgress.Cava).toEqual(expect.objectContaining({
      timesCorrect: 1,
      repetitions: 1,
      interval: 1,
      nextReview: '2026-08-15T00:00:00.000Z',
    }))
    expect(reloaded.result.current.progress.stats.trackedAccuracy).toEqual({
      correct: 1,
      answered: 1,
      startedAt: '2026-08-14T00:00:00.000Z',
    })
    expect(reloaded.result.current.progress.stats.byMode).toEqual({
      'category-match': { correct: 1, answered: 1 },
    })
    expect(reloaded.result.current.progress.categoryProgress.sparkling).toEqual({
      timesCorrect: 1,
      timesIncorrect: 0,
    })
  })

  it('tracks same-day, consecutive, and broken quiz streaks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T08:00:00Z'))
    const { result } = renderHook(() => useProgress())

    act(() => result.current.completeQuiz({ sessionId: 'one', completedAt: new Date() }))
    act(() => result.current.completeQuiz({ sessionId: 'two', completedAt: new Date() }))
    expect(result.current.progress.streakData).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastQuizDate: '2026-08-10',
      activityDates: ['2026-08-10'],
    })

    vi.setSystemTime(new Date('2026-08-11T08:00:00Z'))
    act(() => result.current.completeQuiz({ sessionId: 'three', completedAt: new Date() }))
    expect(result.current.progress.streakData.currentStreak).toBe(2)

    vi.setSystemTime(new Date('2026-08-14T08:00:00Z'))
    act(() => result.current.completeQuiz({ sessionId: 'four', completedAt: new Date() }))
    expect(result.current.progress.streakData).toEqual(expect.objectContaining({
      currentStreak: 1,
      longestStreak: 2,
      lastQuizDate: '2026-08-14',
    }))
    expect(result.current.progress.stats.totalQuizzes).toBe(4)
  })

  it('does not count the same completed session twice', () => {
    const { result } = renderHook(() => useProgress())

    act(() => {
      result.current.completeQuiz({
        sessionId: 'stable-session',
        kind: 'review',
        completedAt: '2026-08-14T08:00:00Z',
      })
      result.current.completeQuiz({
        sessionId: 'stable-session',
        kind: 'review',
        completedAt: '2026-08-14T08:00:00Z',
      })
    })

    expect(result.current.progress.stats.totalQuizzes).toBe(1)
    expect(result.current.progress.stats.completedSessionIds).toEqual(['stable-session'])
  })

  it('keeps a completed session idempotent after reload', async () => {
    const firstRender = renderHook(() => useProgress())
    act(() => {
      firstRender.result.current.completeQuiz({
        sessionId: 'persisted-session',
        kind: 'review',
        completedAt: '2026-08-14T08:00:00Z',
      })
    })
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('wineQuizProgress')).stats.totalQuizzes).toBe(1)
    })
    firstRender.unmount()

    const reloaded = renderHook(() => useProgress())
    act(() => {
      reloaded.result.current.completeQuiz({
        sessionId: 'persisted-session',
        kind: 'review',
        completedAt: '2026-08-14T08:00:00Z',
      })
    })

    expect(reloaded.result.current.progress.stats.totalQuizzes).toBe(1)
    expect(reloaded.result.current.progress.stats.completedSessionIds).toEqual(['persisted-session'])
    expect(reloaded.result.current.progress.streakData.activityDates).toEqual(['2026-08-14'])
  })

  it('toggles appearance, marks study state, and resets fresh defaults', () => {
    const { result } = renderHook(() => useProgress())

    act(() => {
      result.current.toggleDarkMode()
      result.current.markWineStudyStatus('Barolo', 'known')
    })
    expect(result.current.progress.settings.darkMode).toBe(true)
    expect(result.current.progress.wineProgress.Barolo).toEqual(expect.objectContaining({
      studyStatus: 'known',
      timesCorrect: 0,
    }))

    act(() => result.current.resetProgress())
    expect(result.current.progress.wineProgress).toEqual({})
    expect(result.current.progress.settings.darkMode).toBe(false)
    expect(result.current.progress.settings.enabledModes).toEqual(DEFAULT_QUIZ_MODE_IDS)
  })

  it('exports the current progress as a dated JSON download', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T08:00:00Z'))
    const createObjectURL = vi.fn(() => 'blob:test-progress')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { result } = renderHook(() => useProgress())

    act(() => result.current.exportProgress())

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-progress')
  })
})
