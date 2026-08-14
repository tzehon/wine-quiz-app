import {
  getQuizConfigurationErrors,
  QUIZ_MODES_BY_ID
} from './quizModes.js';

const OPTION_COUNTS = Object.freeze({
  easy: 3,
  medium: 4,
  hard: 5
});

const MAX_WINE_SELECTION_OPTIONS = 8;
const MAX_WINE_SELECTION_DISTRACTORS = 4;

export { getQuizConfigurationErrors } from './quizModes.js';

export class QuizConfigurationError extends Error {
  constructor(errors) {
    super(`Invalid quiz configuration: ${errors.join(' ')}`);
    this.name = 'QuizConfigurationError';
    this.errors = [...errors];
  }
}

export function getOptionCount(difficulty) {
  return Object.hasOwn(OPTION_COUNTS, difficulty)
    ? OPTION_COUNTS[difficulty]
    : OPTION_COUNTS.medium;
}

function readRandom(rng) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Quiz RNG must return a finite number greater than or equal to 0 and less than 1.');
  }
  return value;
}

function randomIndex(length, rng) {
  if (length <= 0) {
    throw new Error('Cannot select a random item from an empty collection.');
  }
  return Math.floor(readRandom(rng) * length);
}

function randomItem(items, rng) {
  return items[randomIndex(items.length, rng)];
}

function shuffle(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, rng);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomItems(items, count, rng) {
  return shuffle(items, rng).slice(0, Math.min(Math.max(count, 0), items.length));
}

function parseOrigins(origin) {
  if (typeof origin !== 'string') return [];
  return [...new Set(
    origin
      .split('/')
      .map(value => value.trim())
      .filter(Boolean)
  )];
}

function enrichWine(wine, style) {
  return {
    ...wine,
    styleId: style.id,
    styleName: style.name,
    styleColor: style.color,
    styleDescription: style.description
  };
}

function flattenWines(styles) {
  return styles.flatMap(style => style.wines.map(wine => enrichWine(wine, style)));
}

function firstSentence(value) {
  if (typeof value !== 'string' || value.length === 0) return '';
  return `${value.split('.')[0]}.`;
}

function generateCategoryMatchQuestion(context) {
  const { selectedWines, catalogStyles, optionCount, rng, targetWine } = context;
  const wine = targetWine || randomItem(selectedWines, rng);
  const correctStyle = catalogStyles.find(style => style.id === wine.styleId);
  const incorrectStyles = randomItems(
    catalogStyles.filter(style => style.id !== wine.styleId),
    optionCount - 1,
    rng
  );

  const options = shuffle([
    {
      id: correctStyle.id,
      name: correctStyle.name,
      color: correctStyle.color,
      description: correctStyle.description,
      isCorrect: true
    },
    ...incorrectStyles.map(style => ({
      id: style.id,
      name: style.name,
      color: style.color,
      description: style.description,
      isCorrect: false
    }))
  ], rng);

  return {
    mode: 'category-match',
    wine,
    options,
    correctAnswer: correctStyle.id,
    hint: `This wine originates from ${wine.origin}.`
  };
}

function generateWineSelectionQuestion(context) {
  const { selectedStyles, catalogWines, rng } = context;
  const style = randomItem(selectedStyles, rng);
  const incorrectCandidates = catalogWines.filter(wine => wine.styleId !== style.id);
  const incorrectCount = Math.min(
    MAX_WINE_SELECTION_DISTRACTORS,
    MAX_WINE_SELECTION_OPTIONS - 1,
    incorrectCandidates.length
  );
  const correctCount = Math.min(
    style.wines.length,
    Math.max(1, MAX_WINE_SELECTION_OPTIONS - incorrectCount)
  );

  const correctOptions = randomItems(style.wines, correctCount, rng).map(wine => ({
    name: wine.name,
    origin: wine.origin,
    styleName: style.name,
    styleColor: style.color,
    isCorrect: true
  }));
  const incorrectOptions = randomItems(incorrectCandidates, incorrectCount, rng).map(wine => ({
    name: wine.name,
    origin: wine.origin,
    styleName: wine.styleName,
    styleColor: wine.styleColor,
    isCorrect: false
  }));
  const options = shuffle([...correctOptions, ...incorrectOptions], rng);
  const correctWines = options.filter(option => option.isCorrect).map(option => option.name);

  return {
    mode: 'wine-selection',
    style,
    options,
    correctWines,
    correctCount: correctWines.length,
    hint: firstSentence(style.description)
  };
}

function generateQuickFireQuestion(context) {
  const { selectedWines, catalogStyles, rng } = context;
  const wine = randomItem(selectedWines, rng);
  const correctStyle = catalogStyles.find(style => style.id === wine.styleId);
  const isTrue = readRandom(rng) >= 0.5;
  const statementStyle = isTrue
    ? correctStyle
    : randomItem(catalogStyles.filter(style => style.id !== wine.styleId), rng);

  return {
    mode: 'quick-fire',
    statement: `${wine.name} is a ${statementStyle.name.toLowerCase().replace(' wine', '')}`,
    isTrue,
    wine,
    correctStyle,
    hint: `Think about wines from ${wine.origin}.`
  };
}

function generateDescriptionMatchQuestion(context) {
  const { selectedStyles, catalogStyles, optionCount, rng } = context;
  const style = randomItem(selectedStyles, rng);
  const exampleWines = style.wines.slice(0, 2).map(wine => wine.name).join(', ');
  const incorrectStyles = randomItems(
    catalogStyles.filter(candidate => candidate.id !== style.id),
    optionCount - 1,
    rng
  );
  const options = shuffle([
    {
      id: style.id,
      name: style.name,
      color: style.color,
      description: style.description,
      isCorrect: true
    },
    ...incorrectStyles.map(candidate => ({
      id: candidate.id,
      name: candidate.name,
      color: candidate.color,
      description: candidate.description,
      isCorrect: false
    }))
  ], rng);

  return {
    mode: 'description-match',
    description: style.description,
    style,
    options,
    correctAnswer: style.id,
    hint: `Examples of this style include ${exampleWines}.`
  };
}

function generateOddOneOutQuestion(context) {
  const { selectedStyles, rng } = context;
  const mainStyleCandidates = selectedStyles.filter(style =>
    style.wines.length >= 3 &&
    selectedStyles.some(candidate => candidate.id !== style.id && candidate.wines.length > 0)
  );
  const mainStyle = randomItem(mainStyleCandidates, rng);
  const mainWines = randomItems(mainStyle.wines, 3, rng);
  const oddStyle = randomItem(
    selectedStyles.filter(style => style.id !== mainStyle.id && style.wines.length > 0),
    rng
  );
  const oddWine = randomItem(oddStyle.wines, rng);

  const options = shuffle([
    ...mainWines.map(wine => ({
      ...wine,
      styleId: mainStyle.id,
      styleName: mainStyle.name,
      isOdd: false
    })),
    {
      ...oddWine,
      styleId: oddStyle.id,
      styleName: oddStyle.name,
      isOdd: true
    }
  ], rng);

  return {
    mode: 'odd-one-out',
    options,
    oddWine: oddWine.name,
    mainStyle,
    oddStyle,
    hint: 'Three wines share the same style category. Look for the one from a different category.'
  };
}

function generateOriginMatchQuestion(context) {
  const { selectedWines, catalogOrigins, optionCount, rng } = context;
  const eligibleWines = selectedWines.filter(wine => {
    const correctOrigins = parseOrigins(wine.origin);
    return correctOrigins.length > 0 && catalogOrigins.some(origin => !correctOrigins.includes(origin));
  });
  const wine = randomItem(eligibleWines, rng);
  const correctOrigins = parseOrigins(wine.origin);
  const incorrectOrigins = catalogOrigins.filter(origin => !correctOrigins.includes(origin));
  const incorrectCount = Math.min(
    incorrectOrigins.length,
    Math.max(1, optionCount - correctOrigins.length)
  );
  const options = shuffle([
    ...correctOrigins.map(origin => ({ origin, isCorrect: true })),
    ...randomItems(incorrectOrigins, incorrectCount, rng)
      .map(origin => ({ origin, isCorrect: false }))
  ], rng);

  return {
    mode: 'origin-match',
    wine,
    options,
    correctOrigins,
    hint: `This is a ${wine.styleName.toLowerCase()}.`
  };
}

const questionGenerators = Object.freeze({
  'category-match': generateCategoryMatchQuestion,
  'wine-selection': generateWineSelectionQuestion,
  'quick-fire': generateQuickFireQuestion,
  'description-match': generateDescriptionMatchQuestion,
  'odd-one-out': generateOddOneOutQuestion,
  'origin-match': generateOriginMatchQuestion
});

/**
 * Generate a complete quiz session.
 *
 * The same inputs and RNG sequence always produce the same questions. Invalid
 * configurations fail before any random values are consumed.
 */
export function generateQuizQuestions({
  selectedModes,
  selectedCategories,
  questionCount,
  wineData,
  difficulty = 'medium',
  rng = Math.random
} = {}) {
  if (questionCount === undefined) {
    throw new QuizConfigurationError(['Question count is required.']);
  }

  const configurationErrors = getQuizConfigurationErrors({
    selectedModes,
    selectedCategories,
    wineData,
    questionCount
  });

  if (configurationErrors.length > 0) {
    throw new QuizConfigurationError(configurationErrors);
  }

  if (typeof rng !== 'function') {
    throw new TypeError('Quiz RNG must be a function.');
  }

  const catalogStyles = wineData.styles;
  const selectedCategorySet = new Set(selectedCategories);
  const selectedStyles = catalogStyles.filter(style => selectedCategorySet.has(style.id));
  const catalogWines = flattenWines(catalogStyles);
  const selectedWines = flattenWines(selectedStyles);
  const catalogOrigins = [...new Set(catalogWines.flatMap(wine => parseOrigins(wine.origin)))];
  const optionCount = getOptionCount(difficulty);
  const modeSequence = shuffle(selectedModes, rng);
  const context = {
    selectedStyles,
    selectedWines,
    catalogStyles,
    catalogWines,
    catalogOrigins,
    optionCount,
    rng
  };

  return Array.from({ length: questionCount }, (_, index) => {
    const mode = modeSequence[index % modeSequence.length];
    const generator = questionGenerators[mode];

    if (
      !Object.hasOwn(questionGenerators, mode) ||
      !Object.hasOwn(QUIZ_MODES_BY_ID, mode) ||
      typeof generator !== 'function'
    ) {
      throw new QuizConfigurationError([`Unsupported quiz mode: ${mode}.`]);
    }

    return {
      ...generator(context),
      id: `quiz-question-${String(index + 1).padStart(3, '0')}-${mode}`
    };
  });
}

/**
 * Generate one exact Category Match question for each due wine still present
 * in the catalog. Targets never change; only answer ordering is randomized.
 */
export function generateReviewQuestions({
  wineNames,
  wineData,
  difficulty = 'medium',
  rng = Math.random
} = {}) {
  if (!Array.isArray(wineNames) || wineNames.length === 0) {
    throw new QuizConfigurationError(['Select at least one wine to review.']);
  }
  if (wineNames.some(wineName => typeof wineName !== 'string' || wineName.length === 0)) {
    throw new QuizConfigurationError(['Review wine names must be non-empty strings.']);
  }
  if (new Set(wineNames).size !== wineNames.length) {
    throw new QuizConfigurationError(['Review wine names must not contain duplicates.']);
  }
  if (!wineData || !Array.isArray(wineData.styles) || wineData.styles.length < 2) {
    throw new QuizConfigurationError(['Review sessions require at least two catalog categories.']);
  }
  if (wineData.styles.some(style => !style || typeof style.id !== 'string' || !Array.isArray(style.wines))) {
    throw new QuizConfigurationError(['Review sessions require valid wine categories.']);
  }
  if (typeof rng !== 'function') {
    throw new TypeError('Quiz RNG must be a function.');
  }

  const catalogStyles = wineData.styles.filter(style => style.wines.length > 0);
  if (catalogStyles.length < 2) {
    throw new QuizConfigurationError([
      'Review sessions require at least two catalog categories with wines.'
    ]);
  }
  const catalogWines = flattenWines(catalogStyles);
  const winesByName = new Map(catalogWines.map(wine => [wine.name, wine]));
  const targetWines = wineNames.map(wineName => winesByName.get(wineName)).filter(Boolean);

  if (targetWines.length === 0) {
    throw new QuizConfigurationError([
      'None of the selected review wines remain in the current catalog.'
    ]);
  }

  const context = {
    selectedWines: targetWines,
    catalogStyles,
    optionCount: getOptionCount(difficulty),
    rng
  };

  return targetWines.map((targetWine, index) => ({
    ...generateCategoryMatchQuestion({ ...context, targetWine }),
    id: `review-question-${String(index + 1).padStart(3, '0')}-category-match`
  }));
}
