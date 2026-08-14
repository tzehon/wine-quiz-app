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
      result.current.recordWineAnswer('Riesling', true)
      result.current.recordWineAnswer('Riesling', false)
      result.current.recordCategoryAnswer('aromatic-white', true)
      result.current.recordCategoryAnswer('aromatic-white', false)
      result.current.incrementQuestions()
    })

    expect(result.current.progress.wineProgress.Riesling).toEqual(expect.objectContaining({
      timesCorrect: 1,
      timesIncorrect: 1,
      lastSeen: expect.any(String),
      easeFactor: 2.5,
    }))
    expect(result.current.progress.categoryProgress['aromatic-white']).toEqual({
      timesCorrect: 1,
      timesIncorrect: 1,
    })
    expect(result.current.progress.stats.totalQuestions).toBe(1)
  })

  it('tracks same-day, consecutive, and broken quiz streaks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T08:00:00Z'))
    const { result } = renderHook(() => useProgress())

    act(() => result.current.updateStreak())
    act(() => result.current.updateStreak())
    expect(result.current.progress.streakData).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastQuizDate: '2026-08-10',
    })

    vi.setSystemTime(new Date('2026-08-11T08:00:00Z'))
    act(() => result.current.updateStreak())
    expect(result.current.progress.streakData.currentStreak).toBe(2)

    vi.setSystemTime(new Date('2026-08-14T08:00:00Z'))
    act(() => result.current.updateStreak())
    expect(result.current.progress.streakData).toEqual(expect.objectContaining({
      currentStreak: 1,
      longestStreak: 2,
      lastQuizDate: '2026-08-14',
    }))
    expect(result.current.progress.stats.totalQuizzes).toBe(4)
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
