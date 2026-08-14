import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import wineData from '../../public/data/wines.json'
import { DEFAULT_QUIZ_MODE_IDS } from '../quiz/quizModes'

const progressApi = vi.hoisted(() => ({
  isReadOnly: false,
  recordQuizAnswer: vi.fn(),
  completeQuiz: vi.fn(),
  updateSettings: vi.fn(),
  toggleDarkMode: vi.fn(),
  resetProgress: vi.fn(),
  exportProgress: vi.fn(),
  importProgress: vi.fn(),
  markWineStudyStatus: vi.fn(),
}))

vi.mock('../hooks/useWineData', () => ({
  useWineData: () => ({
    wineData,
    pronunciations: {},
    loading: false,
    error: null,
    lastUpdated: wineData.lastUpdated,
    refresh: vi.fn(),
    getAllStyles: () => wineData.styles,
    getAllWines: () => wineData.styles.flatMap(style =>
      style.wines.map(wine => ({ ...wine, styleId: style.id })),
    ),
  }),
}))

vi.mock('../hooks/useProgress', () => ({
  useProgress: () => ({
    progress: {
      wineProgress: {
        Cava: {
          timesCorrect: 1,
          timesIncorrect: 0,
          lastSeen: '2026-08-01T00:00:00Z',
          nextReview: '2026-08-02T00:00:00Z',
          repetitions: 1,
        },
      },
      categoryProgress: {},
      streakData: { currentStreak: 0, longestStreak: 0, lastQuizDate: null, activityDates: [] },
      settings: {
        enabledModes: [...DEFAULT_QUIZ_MODE_IDS],
        difficulty: 'medium',
        questionsPerSession: 10,
        darkMode: false,
      },
      stats: {
        totalQuizzes: 0,
        totalQuestions: 0,
        trackedAccuracy: { correct: 0, answered: 0, startedAt: null },
      },
    },
    ...progressApi,
  }),
}))

import { App } from '../components/App'

describe('App quiz navigation', () => {
  it('opens configuration from the Home call to action', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /start quiz/i }))

    expect(screen.getByRole('heading', { name: 'Configure Your Quiz' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeEnabled()
  })

  it('opens configuration from the Quiz navigation item instead of showing Home', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^🎯\s*Quiz$/ }))

    expect(screen.getByRole('heading', { name: 'Configure Your Quiz' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Wine Quiz' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^🎯\s*Quiz$/ })).toHaveAttribute('aria-current', 'page')
  })

  it('returns to Home and resets the quiz route', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^🎯\s*Quiz$/ }))
    await user.click(screen.getByRole('button', { name: /^🏠\s*Home$/ }))

    expect(screen.getByRole('heading', { name: 'Wine Quiz' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^🏠\s*Home$/ })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the truthful progress dashboard from navigation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^📊\s*Progress$/ }))

    expect(screen.getByRole('heading', { name: 'Your Progress' })).toBeInTheDocument()
    expect(screen.getByText('Tracked Accuracy')).toBeInTheDocument()
    expect(screen.getByText('Style Reviews Due')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^📊\s*Progress$/ })).toHaveAttribute('aria-current', 'page')
  })

  it('runs the exact due wine through review and records one atomic learning event', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /review 1 wine style/i }))

    expect(screen.getByRole('heading', { name: 'What style is this wine?' })).toBeInTheDocument()
    expect(screen.getByText('Cava')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Sparkling Wine/ }))

    expect(progressApi.recordQuizAnswer).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'category-match',
      isCorrect: true,
      wineResults: [{ wineName: 'Cava', isCorrect: true }],
      categoryResults: [{ categoryId: 'sparkling', isCorrect: true }],
    }))

    await user.click(screen.getByRole('button', { name: 'See Results' }))
    expect(screen.getByRole('heading', { name: 'Review Complete' })).toBeInTheDocument()
    expect(progressApi.completeQuiz).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: expect.any(String),
      kind: 'review',
      score: 1,
      total: 1,
    }))
  })

  it('retries the exact wine missed in a review session', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /review 1 wine style/i }))
    const wrongAnswer = screen.getAllByRole('button').find(button =>
      button.classList.contains('option-btn') &&
      !button.textContent.startsWith('Sparkling Wine'),
    )
    expect(wrongAnswer).toBeDefined()
    await user.click(wrongAnswer)
    await user.click(screen.getByRole('button', { name: 'See Results' }))

    expect(screen.getByText('Cava')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry Mistakes' }))

    expect(screen.getByRole('heading', { name: 'What style is this wine?' })).toBeInTheDocument()
    expect(screen.getByText('Cava')).toBeInTheDocument()
    expect(screen.getByText('1 / 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Sparkling Wine/ }))
    await user.click(screen.getByRole('button', { name: 'See Results' }))

    expect(progressApi.recordQuizAnswer).toHaveBeenCalledTimes(2)
    expect(progressApi.recordQuizAnswer).toHaveBeenLastCalledWith(expect.objectContaining({
      isCorrect: true,
      wineResults: [{ wineName: 'Cava', isCorrect: true }],
    }))
    expect(progressApi.completeQuiz).toHaveBeenCalledTimes(2)
    const [firstSession, retrySession] = progressApi.completeQuiz.mock.calls.map(([session]) => session)
    expect(firstSession.sessionId).not.toBe(retrySession.sessionId)
    expect(retrySession).toEqual(expect.objectContaining({
      kind: 'review',
      score: 1,
      total: 1,
    }))
  })
})
