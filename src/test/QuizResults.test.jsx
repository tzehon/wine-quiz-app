import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuizResults } from '../components/QuizResults'

describe('QuizResults', () => {
  it('renders a zero-safe practice result', () => {
    render(
      <QuizResults
        results={{ score: 0, total: 0, answers: [] }}
        onPlayAgain={vi.fn()}
        onGoHome={vi.fn()}
        darkMode={false}
      />,
    )

    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play Again' })).toBeInTheDocument()
  })

  it('labels review completion and retries exact incorrect wine targets', async () => {
    const user = userEvent.setup()
    const onRetryMistakes = vi.fn()
    render(
      <QuizResults
        results={{
          score: 0,
          total: 2,
          answers: [
            {
              question: { id: 'review-1', wine: { name: 'Cava' } },
              isCorrect: false,
              details: { explanation: 'Sparkling Wine.' },
            },
            {
              question: { id: 'review-2', wine: { name: 'Cava' } },
              isCorrect: false,
              details: { explanation: 'Still sparkling.' },
            },
          ],
        }}
        sessionKind="review"
        onRetryMistakes={onRetryMistakes}
        onGoHome={vi.fn()}
        darkMode={false}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Review Complete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play Again' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry Mistakes' }))
    expect(onRetryMistakes).toHaveBeenCalledWith(['Cava'])
  })

  it('uses the odd wine label in incorrect-answer review', () => {
    render(
      <QuizResults
        results={{
          score: 0,
          total: 1,
          answers: [{
            question: { id: 'odd-1', oddWine: 'Riesling' },
            isCorrect: false,
            details: {},
          }],
        }}
        onPlayAgain={vi.fn()}
        onGoHome={vi.fn()}
        darkMode={false}
      />,
    )

    expect(screen.getByText('Riesling')).toBeInTheDocument()
  })
})
