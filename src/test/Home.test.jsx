import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Home } from '../components/Home'

const wineData = {
  styles: [
    {
      id: 'aromatic-white',
      wines: [{ name: 'Riesling', origin: 'Germany' }],
    },
  ],
}

describe('Home', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the learning summary and connects its primary actions', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))
    const user = userEvent.setup()
    const onStartQuiz = vi.fn()
    const onStartReview = vi.fn()
    const onNavigate = vi.fn()
    const progress = {
      wineProgress: {
        Riesling: {
          timesCorrect: 1,
          timesIncorrect: 0,
          nextReview: new Date(Date.now() - 60_000).toISOString(),
        },
      },
      streakData: {
        currentStreak: 3,
        activityDates: [],
      },
      stats: {
        totalQuestions: 5,
        trackedAccuracy: { correct: 4, answered: 5, startedAt: '2026-08-01T00:00:00Z' },
      },
    }
    render(
      <Home
        progress={progress}
        wineData={wineData}
        onStartQuiz={onStartQuiz}
        onStartReview={onStartReview}
        onNavigate={onNavigate}
        darkMode={false}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Wine Quiz' })).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('1/1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /review 1 wine style/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start quiz/i }))
    await user.click(screen.getByRole('button', { name: /study mode/i }))
    await user.click(screen.getByRole('button', { name: /view progress/i }))
    await user.click(screen.getByRole('button', { name: /review 1 wine style/i }))

    expect(onStartQuiz).toHaveBeenCalledOnce()
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'study')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'progress')
    expect(onStartReview).toHaveBeenCalledOnce()
  })

  it('disables learning actions for a protected future progress save', () => {
    const progress = {
      wineProgress: {},
      categoryProgress: {},
      streakData: { currentStreak: 0, longestStreak: 0, lastQuizDate: null, activityDates: [] },
      stats: { totalQuizzes: 0, totalQuestions: 0, trackedAccuracy: {} },
    }

    render(
      <Home
        progress={progress}
        wineData={wineData}
        isReadOnly
        onStartQuiz={vi.fn()}
        onStartReview={vi.fn()}
        onNavigate={vi.fn()}
        darkMode={false}
      />,
    )

    expect(screen.getByRole('button', { name: /start quiz/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /study mode/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /view progress/i })).toBeEnabled()
  })
})
