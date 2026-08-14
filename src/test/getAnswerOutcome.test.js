import { describe, expect, it } from 'vitest'
import { getAnswerOutcome } from '../quiz/getAnswerOutcome'

describe('getAnswerOutcome', () => {
  it('maps Category Match to the exact question wine and category', () => {
    expect(getAnswerOutcome({
      mode: 'category-match',
      wine: { name: 'Riesling', styleId: 'aromatic-white' },
    }, 'aromatic-white', true, {
      wineName: 'Wrong fallback',
      categoryId: 'wrong-category',
    })).toEqual({
      mode: 'category-match',
      isCorrect: true,
      wineResults: [{ wineName: 'Riesling', isCorrect: true }],
      categoryResults: [{ categoryId: 'aromatic-white', isCorrect: true }],
    })
  })

  it('maps a Quick Fire timeout to one incorrect wine and category result', () => {
    expect(getAnswerOutcome({
      mode: 'quick-fire',
      wine: { name: 'Gamay', styleId: 'light-red' },
    }, null, false, {
      wineName: 'Gamay',
      categoryId: 'light-red',
    })).toEqual({
      mode: 'quick-fire',
      isCorrect: false,
      wineResults: [{ wineName: 'Gamay', isCorrect: false }],
      categoryResults: [{ categoryId: 'light-red', isCorrect: false }],
    })
  })

  it('does not advance exact-style review after correctly rejecting a false Quick Fire claim', () => {
    expect(getAnswerOutcome({
      mode: 'quick-fire',
      isTrue: false,
      wine: { name: 'Gamay', styleId: 'light-red' },
    }, false, true)).toEqual({
      mode: 'quick-fire',
      isCorrect: true,
      wineResults: [],
      categoryResults: [],
    })
  })

  it('advances exact-style review after confirming a true Quick Fire claim', () => {
    expect(getAnswerOutcome({
      mode: 'quick-fire',
      isTrue: true,
      wine: { name: 'Gamay', styleId: 'light-red' },
    }, true, true)).toEqual({
      mode: 'quick-fire',
      isCorrect: true,
      wineResults: [{ wineName: 'Gamay', isCorrect: true }],
      categoryResults: [{ categoryId: 'light-red', isCorrect: true }],
    })
  })

  it('tracks Origin Match accuracy without changing the style review schedule', () => {
    expect(getAnswerOutcome({
      mode: 'origin-match',
      wine: { name: 'Cava', styleId: 'sparkling' },
    }, 'France', false, {
      wineName: 'Champagne',
      categoryId: 'full-white',
    })).toEqual({
      mode: 'origin-match',
      isCorrect: false,
      wineResults: [],
      categoryResults: [],
    })
  })

  it('grades every visible Wine Selection option by its selected state', () => {
    const question = {
      mode: 'wine-selection',
      style: { id: 'sparkling' },
      options: [
        { name: 'Cava', isCorrect: true },
        { name: 'Champagne', isCorrect: true },
        { name: 'Riesling', isCorrect: false },
        { name: 'Gamay', isCorrect: false },
      ],
    }

    expect(getAnswerOutcome(question, ['Cava', 'Riesling'], false)).toEqual({
      mode: 'wine-selection',
      isCorrect: false,
      wineResults: [
        { wineName: 'Cava', isCorrect: true },
        { wineName: 'Champagne', isCorrect: false },
        { wineName: 'Riesling', isCorrect: false },
      ],
      categoryResults: [{ categoryId: 'sparkling', isCorrect: false }],
    })
  })

  it('supports a correct Wine Selection Set answer', () => {
    const question = {
      mode: 'wine-selection',
      style: { id: 'light-red' },
      options: [
        { name: 'Gamay', isCorrect: true },
        { name: 'Pinot Noir', isCorrect: true },
        { name: 'Merlot', isCorrect: false },
      ],
    }

    expect(getAnswerOutcome(question, new Set(['Gamay', 'Pinot Noir']), true)).toEqual({
      mode: 'wine-selection',
      isCorrect: true,
      wineResults: [
        { wineName: 'Gamay', isCorrect: true },
        { wineName: 'Pinot Noir', isCorrect: true },
      ],
      categoryResults: [{ categoryId: 'light-red', isCorrect: true }],
    })
  })

  it('maps a wrong Odd One Out choice to the actual odd wine and category', () => {
    expect(getAnswerOutcome({
      mode: 'odd-one-out',
      oddWine: 'Riesling',
      oddStyle: { id: 'aromatic-white' },
      options: [
        { name: 'Gamay', styleId: 'light-red', isOdd: false },
        { name: 'Riesling', styleId: 'aromatic-white', isOdd: true },
      ],
    }, 'Gamay', false, {
      wineName: 'Gamay',
      categoryId: 'light-red',
    })).toEqual({
      mode: 'odd-one-out',
      isCorrect: false,
      wineResults: [{ wineName: 'Riesling', isCorrect: false }],
      categoryResults: [{ categoryId: 'aromatic-white', isCorrect: false }],
    })
  })

  it('does not advance exact-style review for a correct Odd One Out distinction', () => {
    expect(getAnswerOutcome({
      mode: 'odd-one-out',
      oddWine: 'Riesling',
      oddStyle: { id: 'aromatic-white' },
    }, 'Riesling', true)).toEqual({
      mode: 'odd-one-out',
      isCorrect: true,
      wineResults: [],
      categoryResults: [],
    })
  })

  it('maps Description Match to its category without a wine result', () => {
    expect(getAnswerOutcome({
      mode: 'description-match',
      style: { id: 'dessert' },
    }, 'sparkling', false)).toEqual({
      mode: 'description-match',
      isCorrect: false,
      wineResults: [],
      categoryResults: [{ categoryId: 'dessert', isCorrect: false }],
    })
  })

  it('deduplicates malformed repeated options and combines conflicting grades safely', () => {
    expect(getAnswerOutcome({
      mode: 'wine-selection',
      style: { id: 'sparkling' },
      options: [
        { name: ' Cava ', isCorrect: true },
        { name: 'Cava', isCorrect: false },
        { name: '', isCorrect: true },
        null,
      ],
    }, ['Cava'], false)).toEqual({
      mode: 'wine-selection',
      isCorrect: false,
      wineResults: [{ wineName: 'Cava', isCorrect: false }],
      categoryResults: [{ categoryId: 'sparkling', isCorrect: false }],
    })
  })

  it('returns an empty defensive outcome for missing or unsupported questions', () => {
    expect(getAnswerOutcome(null, null, 'truthy', null)).toEqual({
      mode: null,
      isCorrect: false,
      wineResults: [],
      categoryResults: [],
    })

    expect(getAnswerOutcome({ mode: 'unknown-mode' }, null, true)).toEqual({
      mode: 'unknown-mode',
      isCorrect: true,
      wineResults: [],
      categoryResults: [],
    })
  })
})
