import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_QUIZ_MODE_IDS,
  QUIZ_DIFFICULTIES,
  QUIZ_MODE_IDS,
  QUIZ_QUESTION_COUNTS
} from '../quiz/quizModes';

const PROGRESS_KEY = 'wineQuizProgress';

const createDefaultSettings = () => ({
  enabledModes: [...DEFAULT_QUIZ_MODE_IDS],
  focusCategories: [],
  difficulty: 'medium',
  questionsPerSession: 10,
  darkMode: false
});

const createDefaultProgress = () => ({
  wineProgress: {},
  categoryProgress: {},
  streakData: {
    currentStreak: 0,
    longestStreak: 0,
    lastQuizDate: null
  },
  settings: createDefaultSettings(),
  stats: {
    totalQuizzes: 0,
    totalQuestions: 0
  }
});

const validQuizModeIds = new Set(QUIZ_MODE_IDS);
const validDifficulties = new Set(QUIZ_DIFFICULTIES);
const validQuestionCounts = new Set(QUIZ_QUESTION_COUNTS);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCounter(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function normalizeNullableString(value) {
  return typeof value === 'string' ? value : null;
}

function normalizeEnabledModes(enabledModes) {
  if (!Array.isArray(enabledModes)) {
    return [...DEFAULT_QUIZ_MODE_IDS];
  }

  const normalized = [...new Set(enabledModes.filter(modeId => validQuizModeIds.has(modeId)))];
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
      .map(([wineName, value]) => [wineName, {
        ...value,
        timesCorrect: normalizeCounter(value.timesCorrect),
        timesIncorrect: normalizeCounter(value.timesIncorrect),
        lastSeen: normalizeNullableString(value.lastSeen),
        nextReview: normalizeNullableString(value.nextReview),
        easeFactor: Number.isFinite(value.easeFactor) && value.easeFactor > 0
          ? value.easeFactor
          : 2.5
      }])
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

function normalizeSavedProgress(savedProgress) {
  const defaults = createDefaultProgress();
  if (!savedProgress || typeof savedProgress !== 'object' || Array.isArray(savedProgress)) {
    return defaults;
  }

  const savedStreak = isRecord(savedProgress.streakData) ? savedProgress.streakData : {};
  const savedStats = isRecord(savedProgress.stats) ? savedProgress.stats : {};

  return {
    ...defaults,
    ...savedProgress,
    wineProgress: normalizeWineProgress(savedProgress.wineProgress),
    categoryProgress: normalizeCategoryProgress(savedProgress.categoryProgress),
    streakData: {
      ...defaults.streakData,
      ...savedStreak,
      currentStreak: normalizeCounter(savedStreak.currentStreak),
      longestStreak: normalizeCounter(savedStreak.longestStreak),
      lastQuizDate: normalizeNullableString(savedStreak.lastQuizDate)
    },
    settings: normalizeSettings(savedProgress.settings),
    stats: {
      ...defaults.stats,
      ...savedStats,
      totalQuizzes: normalizeCounter(savedStats.totalQuizzes),
      totalQuestions: normalizeCounter(savedStats.totalQuestions)
    }
  };
}

/**
 * Hook for managing user progress in localStorage
 */
export function useProgress() {
  const [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      try {
        return normalizeSavedProgress(JSON.parse(saved));
      } catch {
        return createDefaultProgress();
      }
    }
    return createDefaultProgress();
  });

  // Save to localStorage whenever progress changes
  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  // Update wine progress after answer
  const recordWineAnswer = useCallback((wineName, isCorrect) => {
    setProgress(prev => {
      const wineData = prev.wineProgress[wineName] || {
        timesCorrect: 0,
        timesIncorrect: 0,
        lastSeen: null,
        nextReview: null,
        easeFactor: 2.5
      };

      const now = new Date().toISOString();

      return {
        ...prev,
        wineProgress: {
          ...prev.wineProgress,
          [wineName]: {
            ...wineData,
            timesCorrect: wineData.timesCorrect + (isCorrect ? 1 : 0),
            timesIncorrect: wineData.timesIncorrect + (isCorrect ? 0 : 1),
            lastSeen: now
          }
        }
      };
    });
  }, []);

  // Update category progress after answer
  const recordCategoryAnswer = useCallback((categoryId, isCorrect) => {
    setProgress(prev => {
      const categoryData = prev.categoryProgress[categoryId] || {
        timesCorrect: 0,
        timesIncorrect: 0
      };

      return {
        ...prev,
        categoryProgress: {
          ...prev.categoryProgress,
          [categoryId]: {
            timesCorrect: categoryData.timesCorrect + (isCorrect ? 1 : 0),
            timesIncorrect: categoryData.timesIncorrect + (isCorrect ? 0 : 1)
          }
        }
      };
    });
  }, []);

  // Update streak after completing a quiz
  const updateStreak = useCallback(() => {
    setProgress(prev => {
      const today = new Date().toISOString().split('T')[0];
      const lastDate = prev.streakData.lastQuizDate;

      let newStreak = prev.streakData.currentStreak;

      if (!lastDate) {
        newStreak = 1;
      } else {
        const lastDateObj = new Date(lastDate);
        const todayObj = new Date(today);
        const diffDays = Math.floor((todayObj - lastDateObj) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day, keep streak
        } else if (diffDays === 1) {
          // Consecutive day, increment streak
          newStreak = prev.streakData.currentStreak + 1;
        } else {
          // Streak broken, reset
          newStreak = 1;
        }
      }

      return {
        ...prev,
        streakData: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, prev.streakData.longestStreak),
          lastQuizDate: today
        },
        stats: {
          ...prev.stats,
          totalQuizzes: prev.stats.totalQuizzes + 1
        }
      };
    });
  }, []);

  // Increment total questions
  const incrementQuestions = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        totalQuestions: prev.stats.totalQuestions + 1
      }
    }));
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings) => {
    setProgress(prev => ({
      ...prev,
      settings: normalizeSettings({ ...prev.settings, ...newSettings })
    }));
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        darkMode: !prev.settings.darkMode
      }
    }));
  }, []);

  // Reset all progress
  const resetProgress = useCallback(() => {
    setProgress(createDefaultProgress());
    localStorage.removeItem(PROGRESS_KEY);
  }, []);

  // Export progress as JSON
  const exportProgress = useCallback(() => {
    const dataStr = JSON.stringify(progress, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wine-quiz-progress-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [progress]);

  // Import progress from JSON
  const importProgress = useCallback((jsonData) => {
    try {
      const imported = JSON.parse(jsonData);
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
        return false;
      }
      setProgress(normalizeSavedProgress(imported));
      return true;
    } catch {
      return false;
    }
  }, []);

  // Mark wine as known/need to study in study mode
  const markWineStudyStatus = useCallback((wineName, status) => {
    setProgress(prev => {
      const wineData = prev.wineProgress[wineName] || {
        timesCorrect: 0,
        timesIncorrect: 0,
        lastSeen: null,
        nextReview: null,
        easeFactor: 2.5
      };

      return {
        ...prev,
        wineProgress: {
          ...prev.wineProgress,
          [wineName]: {
            ...wineData,
            studyStatus: status
          }
        }
      };
    });
  }, []);

  return {
    progress,
    recordWineAnswer,
    recordCategoryAnswer,
    updateStreak,
    incrementQuestions,
    updateSettings,
    toggleDarkMode,
    resetProgress,
    exportProgress,
    importProgress,
    markWineStudyStatus
  };
}
