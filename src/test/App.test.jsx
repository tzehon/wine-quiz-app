import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import wineData from '../../public/data/wines.json'
import { DEFAULT_QUIZ_MODE_IDS } from '../quiz/quizModes'

const progressApi = vi.hoisted(() => ({
  recordWineAnswer: vi.fn(),
  recordCategoryAnswer: vi.fn(),
  updateStreak: vi.fn(),
  incrementQuestions: vi.fn(),
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
  }),
}))

vi.mock('../hooks/useProgress', () => ({
  useProgress: () => ({
    progress: {
      wineProgress: {},
      categoryProgress: {},
      streakData: { currentStreak: 0, longestStreak: 0, lastQuizDate: null },
      settings: {
        enabledModes: [...DEFAULT_QUIZ_MODE_IDS],
        difficulty: 'medium',
        questionsPerSession: 10,
        darkMode: false,
      },
      stats: { totalQuizzes: 0, totalQuestions: 0 },
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
})
