function normalizeIdentifier(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function addResult(resultsById, id, isCorrect, idField) {
  const normalizedId = normalizeIdentifier(id)
  if (!normalizedId) return

  const normalizedCorrectness = isCorrect === true
  const existing = resultsById.get(normalizedId)

  if (existing) {
    existing.isCorrect = existing.isCorrect && normalizedCorrectness
    return
  }

  resultsById.set(normalizedId, {
    [idField]: normalizedId,
    isCorrect: normalizedCorrectness,
  })
}

function getSelectedWineNames(answer) {
  const values = Array.isArray(answer)
    ? answer
    : answer instanceof Set
      ? [...answer]
      : []

  return new Set(values.map(normalizeIdentifier).filter(Boolean))
}

function findOddOption(question) {
  return Array.isArray(question?.options)
    ? question.options.find(option => option?.isOdd === true)
    : null
}

/**
 * Convert a quiz-mode answer into the normalized progress updates it assesses.
 *
 * Whole-question correctness is kept separate from the per-wine results used
 * by multi-select questions. Malformed or duplicate identifiers are ignored or
 * safely collapsed so one answer cannot update the same item twice.
 */
export function getAnswerOutcome(question, answer, isCorrect, details = {}) {
  const safeQuestion = question && typeof question === 'object' ? question : {}
  const safeDetails = details && typeof details === 'object' ? details : {}
  const mode = normalizeIdentifier(safeQuestion.mode)
  const wholeCorrect = isCorrect === true
  const wineResultsByName = new Map()
  const categoryResultsById = new Map()

  const addWine = (wineName, result = wholeCorrect) => {
    addResult(wineResultsByName, wineName, result, 'wineName')
  }
  const addCategory = (categoryId, result = wholeCorrect) => {
    addResult(categoryResultsById, categoryId, result, 'categoryId')
  }

  switch (mode) {
    case 'category-match':
      addWine(safeQuestion.wine?.name ?? safeDetails.wineName)
      addCategory(safeQuestion.wine?.styleId ?? safeDetails.categoryId)
      break

    case 'quick-fire':
      // A correct "No" only rules out the displayed wrong style. It does not
      // prove the learner knows the wine's exact style, so it is not enough to
      // advance that style-review schedule.
      if (!wholeCorrect || safeQuestion.isTrue === true) {
        addWine(safeQuestion.wine?.name ?? safeDetails.wineName)
        addCategory(safeQuestion.wine?.styleId ?? safeDetails.categoryId)
      }
      break

    case 'origin-match':
      // Origin questions contribute to overall and per-mode accuracy, but do
      // not alter the style-classification schedule reviewed by Category Match.
      break

    case 'wine-selection': {
      const selectedWineNames = getSelectedWineNames(answer)
      const options = Array.isArray(safeQuestion.options) ? safeQuestion.options : []

      options.forEach(option => {
        const wineName = normalizeIdentifier(option?.name)
        if (!wineName) return

        const isSelected = selectedWineNames.has(wineName)
        const belongsToTargetStyle = option?.isCorrect === true
        if (belongsToTargetStyle || isSelected) {
          addWine(wineName, isSelected === belongsToTargetStyle)
        }
      })

      addCategory(safeQuestion.style?.id ?? safeDetails.categoryId)
      break
    }

    case 'odd-one-out': {
      // A miss is useful evidence that the odd wine needs explicit style
      // review. A correct answer establishes difference, not its exact style.
      if (!wholeCorrect) {
        const oddOption = findOddOption(safeQuestion)
        addWine(safeQuestion.oddWine ?? oddOption?.name, false)
        addCategory(safeQuestion.oddStyle?.id ?? oddOption?.styleId, false)
      }
      break
    }

    case 'description-match':
      addCategory(safeQuestion.style?.id ?? safeDetails.categoryId)
      break

    default:
      break
  }

  return {
    mode,
    isCorrect: wholeCorrect,
    wineResults: [...wineResultsByName.values()],
    categoryResults: [...categoryResultsById.values()],
  }
}
