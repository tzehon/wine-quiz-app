import { describe, expect, it } from 'vitest'
import wineData from '../../public/data/wines.json'
import {
  generateQuizQuestions,
  getOptionCount,
  getQuizConfigurationErrors,
  QuizConfigurationError,
} from '../quiz/generateQuizQuestions'
import { DEFAULT_QUIZ_MODE_IDS, QUIZ_MODE_IDS, QUIZ_MODES } from '../quiz/quizModes'

function createSeededRng(seed = 1) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const allCategoryIds = wineData.styles.map(style => style.id)

describe('quiz mode registry', () => {
  it('contains exactly the six implemented modes', () => {
    expect(QUIZ_MODES).toHaveLength(6)
    expect(QUIZ_MODE_IDS).toEqual(DEFAULT_QUIZ_MODE_IDS)
    expect(QUIZ_MODE_IDS).not.toContain('pronunciation')
    expect(new Set(QUIZ_MODE_IDS).size).toBe(QUIZ_MODE_IDS.length)
  })

  it('maps difficulties to option counts and safely defaults', () => {
    expect(getOptionCount('easy')).toBe(3)
    expect(getOptionCount('medium')).toBe(4)
    expect(getOptionCount('hard')).toBe(5)
    expect(getOptionCount('unknown')).toBe(4)
    expect(getOptionCount('constructor')).toBe(4)
    expect(getOptionCount('__proto__')).toBe(4)
  })
})

describe('getQuizConfigurationErrors', () => {
  it('reports missing and unsupported selections', () => {
    expect(getQuizConfigurationErrors({
      selectedModes: [],
      selectedCategories: [],
      wineData,
    })).toEqual(expect.arrayContaining([
      'Select at least one quiz mode.',
      'Select at least one wine category.',
    ]))

    expect(getQuizConfigurationErrors({
      selectedModes: ['pronunciation'],
      selectedCategories: ['rose'],
      wineData,
    })).toContain('Unsupported quiz mode: pronunciation.')

    for (const inheritedName of ['constructor', 'toString', '__proto__']) {
      expect(getQuizConfigurationErrors({
        selectedModes: [inheritedName],
        selectedCategories: ['rose'],
        wineData,
      })).toContain(`Unsupported quiz mode: ${inheritedName}.`)
    }
  })

  it('explains why Odd One Out cannot use a single small category', () => {
    expect(getQuizConfigurationErrors({
      selectedModes: ['odd-one-out'],
      selectedCategories: ['rose'],
      wineData,
    })).toContain(
      'Odd One Out requires at least two selected categories, including one category with at least three wines.',
    )
  })

  it('accepts every implemented mode with the full catalog', () => {
    expect(getQuizConfigurationErrors({
      selectedModes: [...QUIZ_MODE_IDS],
      selectedCategories: allCategoryIds,
      wineData,
    })).toEqual([])
  })
})

describe('generateQuizQuestions', () => {
  it('returns the exact requested count with stable unique IDs and balanced modes', () => {
    const questions = generateQuizQuestions({
      selectedModes: [...QUIZ_MODE_IDS],
      selectedCategories: allCategoryIds,
      questionCount: 24,
      wineData,
      difficulty: 'hard',
      rng: createSeededRng(42),
    })

    expect(questions).toHaveLength(24)
    expect(new Set(questions.map(question => question.id)).size).toBe(24)
    for (const modeId of QUIZ_MODE_IDS) {
      expect(questions.filter(question => question.mode === modeId)).toHaveLength(4)
    }
  })

  it('is reproducible when given the same random source', () => {
    const config = {
      selectedModes: ['category-match', 'origin-match'],
      selectedCategories: ['light-white', 'medium-red'],
      questionCount: 8,
      wineData,
      difficulty: 'medium',
    }

    expect(generateQuizQuestions({ ...config, rng: createSeededRng(99) }))
      .toEqual(generateQuizQuestions({ ...config, rng: createSeededRng(99) }))
  })

  it('uses catalog distractors for a focused Wine Selection question', () => {
    const [question] = generateQuizQuestions({
      selectedModes: ['wine-selection'],
      selectedCategories: ['rose'],
      questionCount: 1,
      wineData,
      rng: createSeededRng(4),
    })

    expect(question.style.id).toBe('rose')
    expect(question.options.some(option => option.isCorrect)).toBe(true)
    expect(question.options.some(option => !option.isCorrect)).toBe(true)
    expect(question.correctWines).toEqual(['Rosé'])
    expect(question.options).toHaveLength(5)
  })

  it('uses catalog origins while keeping the target in the focused category', () => {
    const [question] = generateQuizQuestions({
      selectedModes: ['origin-match'],
      selectedCategories: ['rose'],
      questionCount: 1,
      wineData,
      difficulty: 'hard',
      rng: createSeededRng(8),
    })

    expect(question.wine.styleId).toBe('rose')
    expect(question.options.some(option => option.isCorrect)).toBe(true)
    expect(question.options.some(option => !option.isCorrect)).toBe(true)
    expect(question.options.length).toBeLessThanOrEqual(5)
  })

  it('honors difficulty for option-based questions', () => {
    for (const [difficulty, optionCount] of [['easy', 3], ['medium', 4], ['hard', 5]]) {
      const [question] = generateQuizQuestions({
        selectedModes: ['category-match'],
        selectedCategories: ['sparkling'],
        questionCount: 1,
        wineData,
        difficulty,
        rng: createSeededRng(12),
      })
      expect(question.options).toHaveLength(optionCount)
    }
  })

  it('throws structured errors before consuming randomness', () => {
    let rngCalls = 0
    const rng = () => {
      rngCalls += 1
      return 0.5
    }

    expect(() => generateQuizQuestions({
      selectedModes: ['odd-one-out'],
      selectedCategories: ['rose'],
      questionCount: 5,
      wineData,
      rng,
    })).toThrow(QuizConfigurationError)
    expect(rngCalls).toBe(0)
  })

  it('rejects invalid counts and random sources', () => {
    const validConfig = {
      selectedModes: ['category-match'],
      selectedCategories: ['sparkling'],
      wineData,
    }

    expect(() => generateQuizQuestions({ ...validConfig, questionCount: 0 }))
      .toThrow('Question count must be a positive integer no greater than 100.')
    expect(() => generateQuizQuestions({ ...validConfig, questionCount: '10' }))
      .toThrow('Question count must be a positive integer no greater than 100.')
    expect(() => generateQuizQuestions({ ...validConfig, questionCount: 101 }))
      .toThrow('Question count must be a positive integer no greater than 100.')
    expect(() => generateQuizQuestions({ ...validConfig, questionCount: 1, rng: () => 1 }))
      .toThrow(RangeError)
  })
})
