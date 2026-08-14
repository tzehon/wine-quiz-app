import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Home } from '../components/Home'

describe('Home', () => {
  it('renders the learning summary and connects its primary actions', async () => {
    const user = userEvent.setup()
    const onStartQuiz = vi.fn()
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
      },
    }
    const wineData = {
      styles: [
        {
          id: 'aromatic-white',
          wines: [{ name: 'Riesling', origin: 'Germany' }],
        },
      ],
    }

    render(
      <Home
        progress={progress}
        wineData={wineData}
        onStartQuiz={onStartQuiz}
        onNavigate={onNavigate}
        darkMode={false}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Wine Quiz' })).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText(/wines due for review/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start quiz/i }))
    await user.click(screen.getByRole('button', { name: /study mode/i }))
    await user.click(screen.getByRole('button', { name: /view progress/i }))

    expect(onStartQuiz).toHaveBeenCalledOnce()
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'study')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'progress')
  })
})
