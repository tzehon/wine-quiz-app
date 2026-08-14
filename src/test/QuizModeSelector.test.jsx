import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import wineData from '../../public/data/wines.json'
import { QuizModeSelector } from '../components/QuizModeSelector'
import { DEFAULT_QUIZ_MODE_IDS } from '../quiz/quizModes'

function SelectorHarness({
  initialModes = [...DEFAULT_QUIZ_MODE_IDS],
  initialCategories = wineData.styles.map(style => style.id),
  onStartQuiz = vi.fn(),
}) {
  const [selectedModes, setSelectedModes] = useState(initialModes)
  const [selectedCategories, setSelectedCategories] = useState(initialCategories)
  const [questionCount, setQuestionCount] = useState(10)

  return (
    <QuizModeSelector
      enabledModes={[...DEFAULT_QUIZ_MODE_IDS]}
      selectedModes={selectedModes}
      onModesChange={setSelectedModes}
      categories={wineData.styles}
      selectedCategories={selectedCategories}
      onCategoriesChange={setSelectedCategories}
      questionCount={questionCount}
      onQuestionCountChange={setQuestionCount}
      onStartQuiz={onStartQuiz}
      darkMode={false}
    />
  )
}

describe('QuizModeSelector', () => {
  it('renders the canonical mode registry without the removed phantom mode', () => {
    render(<SelectorHarness />)

    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(16)
    expect(screen.getByRole('button', { name: /category match/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /origin match/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pronunciation/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeEnabled()
  })

  it('prevents an invalid Odd One Out configuration and explains how to recover', () => {
    render(
      <SelectorHarness
        initialModes={['odd-one-out']}
        initialCategories={['rose']}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Odd One Out requires at least two selected categories, including one category with at least three wines.',
    )
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeDisabled()
  })

  it('becomes valid after selecting an eligible companion category', async () => {
    const user = userEvent.setup()
    const onStartQuiz = vi.fn()
    render(
      <SelectorHarness
        initialModes={['odd-one-out']}
        initialCategories={['rose']}
        onStartQuiz={onStartQuiz}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Sparkling Wine' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const startButton = screen.getByRole('button', { name: 'Start Quiz' })
    expect(startButton).toBeEnabled()
    await user.click(startButton)
    expect(onStartQuiz).toHaveBeenCalledOnce()
  })

  it('keeps Select All derived from the actual selected state', async () => {
    const user = userEvent.setup()
    render(<SelectorHarness />)

    const selectModesButton = screen.getAllByRole('button', { name: 'Deselect All' })[0]
    await user.click(selectModesButton)

    expect(screen.getByText('Select at least one quiz mode.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Select All' })[0]).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Select All' })[0])
    expect(screen.queryByText('Select at least one quiz mode.')).not.toBeInTheDocument()
  })

  it('updates the question count as a pressed single-choice control', async () => {
    const user = userEvent.setup()
    render(<SelectorHarness />)

    await user.click(screen.getByRole('button', { name: '20' }))

    expect(screen.getByRole('button', { name: '20' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '10' })).toHaveAttribute('aria-pressed', 'false')
  })
})
