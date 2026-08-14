import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickFire } from '../quizModes/QuickFire'

const question = {
  statement: 'Riesling is an aromatic white',
  isTrue: true,
  wine: { name: 'Riesling', styleId: 'aromatic-white' },
  correctStyle: { name: 'Aromatic White Wine' },
}

describe('QuickFire', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down and records exactly one timeout answer', () => {
    const onTimeUp = vi.fn()
    render(
      <QuickFire
        question={question}
        onAnswer={vi.fn()}
        onTimeUp={onTimeUp}
        showFeedback={false}
        darkMode={false}
      />,
    )

    expect(screen.getByRole('timer')).toHaveTextContent('10s')
    act(() => vi.advanceTimersByTime(10_000))

    expect(screen.getByRole('timer')).toHaveTextContent('0s')
    expect(onTimeUp).toHaveBeenCalledOnce()
    expect(onTimeUp).toHaveBeenCalledWith(null, false, {
      wineName: 'Riesling',
      categoryId: 'aromatic-white',
      explanation: "Time's up! The answer was Yes.",
    })

    act(() => vi.advanceTimersByTime(5_000))
    expect(onTimeUp).toHaveBeenCalledOnce()
  })

  it('stops the timer after a manual answer', () => {
    const onAnswer = vi.fn()
    const onTimeUp = vi.fn()
    render(
      <QuickFire
        question={question}
        onAnswer={onAnswer}
        onTimeUp={onTimeUp}
        showFeedback={false}
        darkMode={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onAnswer).toHaveBeenCalledWith(true, true, expect.objectContaining({
      wineName: 'Riesling',
      categoryId: 'aromatic-white',
    }))

    act(() => vi.advanceTimersByTime(12_000))
    expect(onTimeUp).not.toHaveBeenCalled()
  })

  it('does not start a new timer while feedback is visible', () => {
    const onTimeUp = vi.fn()
    render(
      <QuickFire
        question={question}
        onAnswer={vi.fn()}
        onTimeUp={onTimeUp}
        showFeedback
        darkMode={false}
      />,
    )

    act(() => vi.advanceTimersByTime(12_000))
    expect(screen.getByRole('timer')).toHaveTextContent('10s')
    expect(onTimeUp).not.toHaveBeenCalled()
  })
})
