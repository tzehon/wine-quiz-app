const modeDefinitions = [
  {
    id: 'category-match',
    name: 'Category Match',
    description: 'Match wines to their style category',
    icon: '🏷️'
  },
  {
    id: 'wine-selection',
    name: 'Wine Selection',
    description: 'Select all wines in a category',
    icon: '☑️'
  },
  {
    id: 'quick-fire',
    name: 'Quick Fire',
    description: 'Rapid yes/no questions with timer',
    icon: '⚡'
  },
  {
    id: 'description-match',
    name: 'Description Match',
    description: 'Match descriptions to categories',
    icon: '📝'
  },
  {
    id: 'odd-one-out',
    name: 'Odd One Out',
    description: 'Find the wine that does not belong',
    icon: '🔍'
  },
  {
    id: 'origin-match',
    name: 'Origin Match',
    description: 'Match wines to their country',
    icon: '🌍'
  }
];

export const QUIZ_MODES = Object.freeze(
  modeDefinitions.map(mode => Object.freeze({ ...mode }))
);

export const QUIZ_MODE_IDS = Object.freeze(QUIZ_MODES.map(mode => mode.id));

// These are intentionally limited to modes that have a question generator and UI.
export const DEFAULT_QUIZ_MODE_IDS = Object.freeze([...QUIZ_MODE_IDS]);

export const QUIZ_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const QUIZ_QUESTION_COUNTS = Object.freeze([5, 10, 15, 20]);
export const MAX_QUIZ_QUESTION_COUNT = 100;

export const QUIZ_MODES_BY_ID = Object.freeze(
  Object.fromEntries(QUIZ_MODES.map(mode => [mode.id, mode]))
);

function parseOrigins(origin) {
  if (typeof origin !== 'string') return [];

  return origin
    .split('/')
    .map(value => value.trim())
    .filter(Boolean);
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

/**
 * Validate a selected quiz configuration against the available wine catalog.
 *
 * Returning all errors lets the configuration UI explain everything that needs
 * attention before attempting question generation.
 */
export function getQuizConfigurationErrors({
  selectedModes,
  selectedCategories,
  wineData,
  questionCount
} = {}) {
  const errors = [];

  if (!Array.isArray(selectedModes)) {
    errors.push('Quiz modes must be provided as an array.');
  } else {
    if (selectedModes.length === 0) {
      errors.push('Select at least one quiz mode.');
    }

    if (hasDuplicates(selectedModes)) {
      errors.push('Quiz modes must not contain duplicates.');
    }

    const unsupportedModes = selectedModes.filter(modeId => !Object.hasOwn(QUIZ_MODES_BY_ID, modeId));
    if (unsupportedModes.length > 0) {
      errors.push(`Unsupported quiz mode${unsupportedModes.length > 1 ? 's' : ''}: ${unsupportedModes.join(', ')}.`);
    }
  }

  if (!Array.isArray(selectedCategories)) {
    errors.push('Quiz categories must be provided as an array.');
  } else {
    if (selectedCategories.length === 0) {
      errors.push('Select at least one wine category.');
    }

    if (hasDuplicates(selectedCategories)) {
      errors.push('Quiz categories must not contain duplicates.');
    }
  }

  if (
    questionCount !== undefined &&
    (!Number.isInteger(questionCount) || questionCount <= 0 || questionCount > MAX_QUIZ_QUESTION_COUNT)
  ) {
    errors.push(`Question count must be a positive integer no greater than ${MAX_QUIZ_QUESTION_COUNT}.`);
  }

  if (!wineData || !Array.isArray(wineData.styles) || wineData.styles.length === 0) {
    errors.push('Wine data must contain at least one style.');
    return errors;
  }

  const styles = wineData.styles.filter(style => style && typeof style.id === 'string');
  const styleIds = styles.map(style => style.id);

  if (styles.length !== wineData.styles.length) {
    errors.push('Every wine style must have a string ID.');
  }

  if (hasDuplicates(styleIds)) {
    errors.push('Wine style IDs must be unique.');
  }

  if (styles.some(style => !Array.isArray(style.wines))) {
    errors.push('Every wine style must contain a wines array.');
  }

  if (!Array.isArray(selectedModes) || !Array.isArray(selectedCategories)) {
    return [...new Set(errors)];
  }

  const stylesById = new Map(styles.map(style => [style.id, style]));
  const unknownCategories = selectedCategories.filter(categoryId => !stylesById.has(categoryId));
  if (unknownCategories.length > 0) {
    errors.push(`Unknown wine categor${unknownCategories.length > 1 ? 'ies' : 'y'}: ${unknownCategories.join(', ')}.`);
  }

  const selectedStyles = selectedCategories
    .map(categoryId => stylesById.get(categoryId))
    .filter(Boolean);

  const emptySelectedStyles = selectedStyles.filter(style => !Array.isArray(style.wines) || style.wines.length === 0);
  if (emptySelectedStyles.length > 0) {
    errors.push(`Selected categor${emptySelectedStyles.length > 1 ? 'ies have' : 'y has'} no wines: ${emptySelectedStyles.map(style => style.name || style.id).join(', ')}.`);
  }

  const selectedModeSet = new Set(
    selectedModes.filter(modeId => Object.hasOwn(QUIZ_MODES_BY_ID, modeId))
  );
  const catalogStylesWithWines = styles.filter(style => Array.isArray(style.wines) && style.wines.length > 0);
  const catalogWines = catalogStylesWithWines.flatMap(style => style.wines);

  if (
    (selectedModeSet.has('category-match') ||
      selectedModeSet.has('description-match') ||
      selectedModeSet.has('quick-fire')) &&
    styles.length < 2
  ) {
    errors.push('Category Match, Description Match, and Quick Fire require at least two catalog categories.');
  }

  if (selectedModeSet.has('wine-selection')) {
    const stylesWithoutDistractors = selectedStyles.filter(style => {
      if (!Array.isArray(style.wines) || style.wines.length === 0) return false;
      return catalogStylesWithWines.every(catalogStyle => catalogStyle.id === style.id);
    });

    if (catalogWines.length === 0 || stylesWithoutDistractors.length > 0) {
      errors.push('Wine Selection requires at least one selected-category wine and one wine from another catalog category.');
    }
  }

  if (selectedModeSet.has('odd-one-out')) {
    const hasMainStyle = selectedStyles.some(style => Array.isArray(style.wines) && style.wines.length >= 3);
    const nonEmptySelectedStyles = selectedStyles.filter(style => Array.isArray(style.wines) && style.wines.length > 0);

    if (nonEmptySelectedStyles.length < 2 || !hasMainStyle) {
      errors.push('Odd One Out requires at least two selected categories, including one category with at least three wines.');
    }
  }

  if (selectedModeSet.has('origin-match')) {
    const catalogOrigins = new Set(catalogWines.flatMap(wine => parseOrigins(wine.origin)));
    const selectedWines = selectedStyles.flatMap(style => Array.isArray(style.wines) ? style.wines : []);
    const hasEligibleWine = selectedWines.some(wine => {
      const correctOrigins = parseOrigins(wine.origin);
      return correctOrigins.length > 0 && [...catalogOrigins].some(origin => !correctOrigins.includes(origin));
    });

    if (!hasEligibleWine) {
      errors.push('Origin Match requires a selected wine and at least one different origin elsewhere in the catalog.');
    }
  }

  return [...new Set(errors)];
}
