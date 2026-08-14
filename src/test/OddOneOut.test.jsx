import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OddOneOut } from '../quizModes/OddOneOut'

const question = {
  id: 'odd-1',
  options: [
    { name: 'Cava', styleId: 'sparkling', styleName: 'Sparkling Wine', isOdd: false },
    { name: 'Prosecco', styleId: 'sparkling', styleName: 'Sparkling Wine', isOdd: false },
    { name: 'Champagne', styleId: 'sparkling', styleName: 'Sparkling Wine', isOdd: false },
    { name: 'Merlot', styleId: 'medium-red', styleName: 'Medium-Bodied Red Wine', isOdd: true },
  ],
  oddWine: 'Merlot',
  mainStyle: { name: 'Sparkling Wine' },
  oddStyle: { name: 'Medium-Bodied Red Wine' },
  hint: 'Look for a different style.',
}

describe('OddOneOut', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
        speak: vi.fn(),
      },
    })
  })

  afterEach(() => {
    delete window.speechSynthesis
  })

  it('keeps pronunciation controls outside answer buttons', () => {
    const { container } = render(
      <OddOneOut
        question={question}
        onAnswer={vi.fn()}
        showFeedback={false}
        darkMode={false}
      />,
    )

    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Merlot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Listen to pronunciation of Merlot' })).toBeInTheDocument()
  })

  it('records the actual option and explains correct and incorrect choices', () => {
    const onAnswer = vi.fn()
    render(
      <OddOneOut
        question={question}
        onAnswer={onAnswer}
        showFeedback={false}
        darkMode={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Merlot' }))
    expect(onAnswer).toHaveBeenLastCalledWith('Merlot', true, expect.objectContaining({
      wineName: 'Merlot',
      categoryId: 'medium-red',
      explanation: expect.stringContaining('Correct!'),
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Cava' }))
    expect(onAnswer).toHaveBeenLastCalledWith('Cava', false, expect.objectContaining({
      explanation: expect.stringContaining('Merlot is the odd one out'),
    }))
  })

  it('reveals and then hides hint controls during feedback', () => {
    const { rerender } = render(
      <OddOneOut
        question={question}
        onAnswer={vi.fn()}
        showFeedback={false}
        darkMode={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show Hint' }))
    expect(screen.getByText('Look for a different style.')).toBeInTheDocument()

    rerender(
      <OddOneOut
        question={question}
        onAnswer={vi.fn()}
        showFeedback
        darkMode={false}
      />,
    )
    expect(screen.queryByText('Look for a different style.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Merlot/ })).toBeDisabled()
  })
})
