import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuizEngine } from '../components/QuizEngine'
import { QuizConfigurationError } from '../quiz/generateQuizQuestions'

const { generateQuizQuestionsMock, generateReviewQuestionsMock } = vi.hoisted(() => ({
  generateQuizQuestionsMock: vi.fn(),
  generateReviewQuestionsMock: vi.fn(),
}))

vi.mock('../quiz/generateQuizQuestions', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    generateQuizQuestions: generateQuizQuestionsMock,
    generateReviewQuestions: generateReviewQuestionsMock,
  }
})

const firstQuestion = {
  id: 'question-1',
  mode: 'wine-selection',
  style: {
    id: 'style-a',
    name: 'Style A',
    color: '#eee',
    description: 'First style.',
  },
  options: [
    { name: 'Alpha', origin: 'France', styleName: 'Style A', styleColor: '#eee', isCorrect: true },
    { name: 'Bravo', origin: 'Italy', styleName: 'Style B', styleColor: '#ddd', isCorrect: false },
  ],
  correctWines: ['Alpha'],
  correctCount: 1,
  hint: 'First style.',
}

const secondQuestion = {
  id: 'question-2',
  mode: 'wine-selection',
  style: {
    id: 'style-b',
    name: 'Style B',
    color: '#ddd',
    description: 'Second style.',
  },
  options: [
    { name: 'Charlie', origin: 'Spain', styleName: 'Style B', styleColor: '#ddd', isCorrect: true },
    { name: 'Delta', origin: 'Germany', styleName: 'Style A', styleColor: '#eee', isCorrect: false },
  ],
  correctWines: ['Charlie'],
  correctCount: 1,
  hint: 'Second style.',
}

function renderEngine(overrides = {}) {
  const props = {
    selectedModes: ['wine-selection'],
    selectedCategories: ['style-a', 'style-b'],
    questionCount: 2,
    wineData: { styles: [] },
    difficulty: 'medium',
    onAnswer: vi.fn(),
    onComplete: vi.fn(),
    onExit: vi.fn(),
    onReconfigure: vi.fn(),
    darkMode: false,
    onToggleDarkMode: vi.fn(),
    ...overrides,
  }

  return { ...render(<QuizEngine {...props} />), props }
}

describe('QuizEngine', () => {
  beforeEach(() => {
    generateQuizQuestionsMock.mockReset()
    generateReviewQuestionsMock.mockReset()
  })

  it('freezes an exact generated session and exposes progress semantics', () => {
    generateQuizQuestionsMock.mockReturnValue([firstQuestion, secondQuestion])

    renderEngine()

    expect(generateQuizQuestionsMock).toHaveBeenCalledOnce()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Quiz progress' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.queryByText('Loading questions...')).not.toBeInTheDocument()
  })

  it('resets local mode state when consecutive questions share a component', async () => {
    const user = userEvent.setup()
    generateQuizQuestionsMock.mockReturnValue([firstQuestion, secondQuestion])

    renderEngine()

    await user.click(screen.getByRole('checkbox', { name: /Alpha/ }))
    expect(screen.getByRole('button', { name: 'Submit (1 selected)' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Submit (1 selected)' }))
    await user.click(screen.getByRole('button', { name: 'Next Question' }))

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByText('Style B')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Charlie/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Delta/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Submit (0 selected)' })).toBeDisabled()
  })

  it('records answers once and completes with the final score', async () => {
    const user = userEvent.setup()
    generateQuizQuestionsMock.mockReturnValue([firstQuestion, secondQuestion])
    const { props } = renderEngine()

    await user.click(screen.getByRole('checkbox', { name: /Alpha/ }))
    await user.click(screen.getByRole('button', { name: 'Submit (1 selected)' }))
    await user.click(screen.getByRole('button', { name: 'Next Question' }))
    await user.click(screen.getByRole('checkbox', { name: /Charlie/ }))
    await user.click(screen.getByRole('button', { name: 'Submit (1 selected)' }))
    await user.click(screen.getByRole('button', { name: 'See Results' }))

    expect(props.onAnswer).toHaveBeenCalledTimes(2)
    expect(props.onAnswer).toHaveBeenNthCalledWith(1, expect.objectContaining({
      mode: 'wine-selection',
      isCorrect: true,
      wineResults: [
        { wineName: 'Alpha', isCorrect: true },
      ],
      categoryResults: [{ categoryId: 'style-a', isCorrect: true }],
      answeredAt: expect.any(String),
    }))
    expect(props.onComplete).toHaveBeenCalledOnce()
    expect(props.onComplete).toHaveBeenCalledWith(expect.objectContaining({
      score: 2,
      total: 2,
      answers: expect.arrayContaining([
        expect.objectContaining({ question: firstQuestion, isCorrect: true }),
        expect.objectContaining({ question: secondQuestion, isCorrect: true }),
      ]),
    }))
  })

  it('shows a recoverable configuration error instead of an endless loader', async () => {
    const user = userEvent.setup()
    generateQuizQuestionsMock.mockImplementation(() => {
      throw new QuizConfigurationError(['Odd One Out needs more categories.'])
    })
    const { props } = renderEngine()

    expect(screen.getByRole('alert')).toHaveTextContent('Odd One Out needs more categories.')
    expect(screen.queryByText('Loading questions...')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change Settings' }))
    await user.click(screen.getByRole('button', { name: 'Go Home' }))
    expect(props.onReconfigure).toHaveBeenCalledOnce()
    expect(props.onExit).toHaveBeenCalledOnce()
  })

  it('generates an exact review session and carries its session identity to completion', async () => {
    const user = userEvent.setup()
    const reviewQuestion = {
      id: 'review-question-001-category-match',
      mode: 'category-match',
      wine: { name: 'Alpha', origin: 'France', styleId: 'style-a' },
      options: [{ id: 'style-a', name: 'Style A', isCorrect: true }],
    }
    generateReviewQuestionsMock.mockReturnValue([reviewQuestion])
    const { props } = renderEngine({
      sessionKind: 'review',
      sessionId: 'review-session-1',
      targetWineNames: ['Alpha'],
    })

    expect(generateReviewQuestionsMock).toHaveBeenCalledWith(expect.objectContaining({
      wineNames: ['Alpha'],
    }))
    expect(generateQuizQuestionsMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Style A' }))
    await user.click(screen.getByRole('button', { name: 'See Results' }))
    expect(props.onComplete).toHaveBeenCalledWith(expect.objectContaining({
      sessionKind: 'review',
      sessionId: 'review-session-1',
      score: 1,
      total: 1,
    }))
  })

  it('gives an orphaned review a Home recovery without quiz settings', async () => {
    const user = userEvent.setup()
    generateReviewQuestionsMock.mockImplementation(() => {
      throw new QuizConfigurationError(['No review wines remain.'])
    })
    const { props } = renderEngine({
      sessionKind: 'review',
      targetWineNames: ['Removed Wine'],
    })

    expect(screen.getByRole('heading', { name: 'Unable to start this review' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change Settings' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go Home' }))
    expect(props.onExit).toHaveBeenCalledOnce()
  })
})
