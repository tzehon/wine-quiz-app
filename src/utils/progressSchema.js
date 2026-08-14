import {
  DEFAULT_QUIZ_MODE_IDS,
  QUIZ_DIFFICULTIES,
  QUIZ_MODE_IDS,
  QUIZ_QUESTION_COUNTS
} from '../quiz/quizModes';

export const PROGRESS_SCHEMA_VERSION = 2;

const validQuizModeIds = new Set(QUIZ_MODE_IDS);
const validDifficulties = new Set(QUIZ_DIFFICULTIES);
const validQuestionCounts = new Set(QUIZ_QUESTION_COUNTS);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCounter(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function normalizePositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeNullableString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeDateKey(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? value
    : null;
}

function createDefaultSettings() {
  return {
    enabledModes: [...DEFAULT_QUIZ_MODE_IDS],
    focusCategories: [],
    difficulty: 'medium',
    questionsPerSession: 10,
    darkMode: false
  };
}

export function createDefaultProgress() {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    wineProgress: {},
    categoryProgress: {},
    streakData: {
      currentStreak: 0,
      longestStreak: 0,
      lastQuizDate: null,
      activityDates: []
    },
    settings: createDefaultSettings(),
    stats: {
      totalQuizzes: 0,
      totalQuestions: 0,
      trackedAccuracy: {
        correct: 0,
        answered: 0,
        startedAt: null
      },
      byMode: {},
      completedSessionIds: []
    }
  };
}

function normalizeEnabledModes(enabledModes) {
  if (!Array.isArray(enabledModes)) {
    return [...DEFAULT_QUIZ_MODE_IDS];
  }

  const normalized = [...new Set(
    enabledModes.filter(modeId => validQuizModeIds.has(modeId))
  )];
  return normalized.length > 0 ? normalized : [...DEFAULT_QUIZ_MODE_IDS];
}

function normalizeSettings(settings) {
  const defaults = createDefaultSettings();
  const value = isRecord(settings) ? settings : {};

  return {
    ...defaults,
    ...value,
    enabledModes: normalizeEnabledModes(value.enabledModes),
    focusCategories: Array.isArray(value.focusCategories)
      ? [...new Set(value.focusCategories.filter(categoryId => typeof categoryId === 'string'))]
      : defaults.focusCategories,
    difficulty: validDifficulties.has(value.difficulty)
      ? value.difficulty
      : defaults.difficulty,
    questionsPerSession: validQuestionCounts.has(value.questionsPerSession)
      ? value.questionsPerSession
      : defaults.questionsPerSession,
    darkMode: typeof value.darkMode === 'boolean' ? value.darkMode : defaults.darkMode
  };
}

function normalizeWineProgress(wineProgress) {
  if (!isRecord(wineProgress)) return {};

  return Object.fromEntries(
    Object.entries(wineProgress)
      .filter(([, value]) => isRecord(value))
      .map(([wineName, value]) => {
        const interval = normalizeCounter(value.interval);
        const repetitions = Number.isFinite(value.repetitions) && value.repetitions >= 0
          ? Math.floor(value.repetitions)
          : interval > 1 ? 2 : interval === 1 ? 1 : 0;

        return [wineName, {
          ...value,
          timesCorrect: normalizeCounter(value.timesCorrect),
          timesIncorrect: normalizeCounter(value.timesIncorrect),
          lastSeen: normalizeNullableString(value.lastSeen),
          nextReview: normalizeNullableString(value.nextReview),
          easeFactor: normalizePositiveNumber(value.easeFactor, 2.5),
          interval,
          repetitions,
          lapses: normalizeCounter(value.lapses)
        }];
      })
  );
}

function normalizeCategoryProgress(categoryProgress) {
  if (!isRecord(categoryProgress)) return {};

  return Object.fromEntries(
    Object.entries(categoryProgress)
      .filter(([, value]) => isRecord(value))
      .map(([categoryId, value]) => [categoryId, {
        ...value,
        timesCorrect: normalizeCounter(value.timesCorrect),
        timesIncorrect: normalizeCounter(value.timesIncorrect)
      }])
  );
}

function normalizeActivityDates(activityDates, lastQuizDate) {
  const values = Array.isArray(activityDates)
    ? activityDates.map(normalizeDateKey).filter(Boolean)
    : [];
  if (lastQuizDate) values.push(lastQuizDate);
  return [...new Set(values)].sort();
}

function normalizeTrackedAccuracy(trackedAccuracy) {
  const value = isRecord(trackedAccuracy) ? trackedAccuracy : {};
  const answered = normalizeCounter(value.answered);
  return {
    correct: Math.min(normalizeCounter(value.correct), answered),
    answered,
    startedAt: answered > 0 ? normalizeNullableString(value.startedAt) : null
  };
}

function normalizeByMode(byMode) {
  if (!isRecord(byMode)) return {};

  return Object.fromEntries(
    Object.entries(byMode)
      .filter(([modeId, value]) => validQuizModeIds.has(modeId) && isRecord(value))
      .map(([modeId, value]) => {
        const answered = normalizeCounter(value.answered);
        return [modeId, {
          correct: Math.min(normalizeCounter(value.correct), answered),
          answered
        }];
      })
  );
}

export function isFutureProgressSchema(value) {
  return isRecord(value) &&
    Number.isInteger(value.schemaVersion) &&
    value.schemaVersion > PROGRESS_SCHEMA_VERSION;
}

export function normalizeSavedProgress(savedProgress) {
  const defaults = createDefaultProgress();
  if (!isRecord(savedProgress) || isFutureProgressSchema(savedProgress)) {
    return defaults;
  }

  const savedStreak = isRecord(savedProgress.streakData) ? savedProgress.streakData : {};
  const lastQuizDate = normalizeDateKey(savedStreak.lastQuizDate);
  const savedStats = isRecord(savedProgress.stats) ? savedProgress.stats : {};

  return {
    ...defaults,
    ...savedProgress,
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    wineProgress: normalizeWineProgress(savedProgress.wineProgress),
    categoryProgress: normalizeCategoryProgress(savedProgress.categoryProgress),
    streakData: {
      ...defaults.streakData,
      ...savedStreak,
      currentStreak: normalizeCounter(savedStreak.currentStreak),
      longestStreak: normalizeCounter(savedStreak.longestStreak),
      lastQuizDate,
      activityDates: normalizeActivityDates(savedStreak.activityDates, lastQuizDate)
    },
    settings: normalizeSettings(savedProgress.settings),
    stats: {
      ...defaults.stats,
      ...savedStats,
      totalQuizzes: normalizeCounter(savedStats.totalQuizzes),
      totalQuestions: normalizeCounter(savedStats.totalQuestions),
      trackedAccuracy: normalizeTrackedAccuracy(savedStats.trackedAccuracy),
      byMode: normalizeByMode(savedStats.byMode),
      completedSessionIds: Array.isArray(savedStats.completedSessionIds)
        ? [...new Set(savedStats.completedSessionIds.filter(id => typeof id === 'string'))].slice(-100)
        : []
    }
  };
}

export function parseProgressImport(jsonData) {
  try {
    const imported = JSON.parse(jsonData);
    if (!isRecord(imported) || isFutureProgressSchema(imported)) {
      return null;
    }
    return normalizeSavedProgress(imported);
  } catch {
    return null;
  }
}

export function normalizeProgressSettings(settings) {
  return normalizeSettings(settings);
}
