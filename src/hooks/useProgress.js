import { useCallback, useEffect, useState } from 'react';
import {
  createDefaultProgress,
  isFutureProgressSchema,
  normalizeProgressSettings,
  normalizeSavedProgress,
  parseProgressImport
} from '../utils/progressSchema';
import { updateWineSchedule } from '../utils/spacedRepetition';

const PROGRESS_KEY = 'wineQuizProgress';

function safeDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export function getLocalDateKey(value = new Date()) {
  const date = safeDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyDifference(laterKey, earlierKey) {
  const toUtc = (dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(laterKey) - toUtc(earlierKey)) / 86_400_000);
}

function normalizeAnswerResults(results, identityKey) {
  if (!Array.isArray(results)) return [];

  const byIdentity = new Map();
  results.forEach(result => {
    const identity = result?.[identityKey];
    if (typeof identity === 'string' && identity.length > 0) {
      byIdentity.set(identity, {
        [identityKey]: identity,
        isCorrect: Boolean(result.isCorrect)
      });
    }
  });
  return [...byIdentity.values()];
}

function loadSavedProgress() {
  const saved = localStorage.getItem(PROGRESS_KEY);
  if (!saved) {
    return { progress: createDefaultProgress(), preserveStoredProgress: false };
  }

  try {
    const parsed = JSON.parse(saved);
    if (isFutureProgressSchema(parsed)) {
      return { progress: createDefaultProgress(), preserveStoredProgress: true };
    }
    return { progress: normalizeSavedProgress(parsed), preserveStoredProgress: false };
  } catch {
    return { progress: createDefaultProgress(), preserveStoredProgress: false };
  }
}

function storageContainsFutureProgress() {
  const stored = localStorage.getItem(PROGRESS_KEY);
  if (!stored) return false;

  try {
    return isFutureProgressSchema(JSON.parse(stored));
  } catch {
    return false;
  }
}

/**
 * Manage the versioned local progress record and keep each learning event
 * atomic so counters, schedules, and accuracy cannot drift apart.
 */
export function useProgress() {
  const [loadedProgress] = useState(loadSavedProgress);
  const [progress, setProgress] = useState(loadedProgress.progress);
  const [isReadOnly, setIsReadOnly] = useState(loadedProgress.preserveStoredProgress);

  useEffect(() => {
    if (isReadOnly) return;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [isReadOnly, progress]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== PROGRESS_KEY || !event.newValue) return;

      try {
        if (isFutureProgressSchema(JSON.parse(event.newValue))) {
          setIsReadOnly(true);
        }
      } catch {
        // Ignore malformed writes from another tab and preserve current state.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const recordQuizAnswer = useCallback(({
    mode,
    isCorrect,
    answeredAt,
    wineResults,
    categoryResults
  } = {}) => {
    if (isReadOnly || storageContainsFutureProgress()) {
      setIsReadOnly(true);
      return;
    }
    const answeredDate = safeDate(answeredAt);
    const answeredIso = answeredDate.toISOString();
    const normalizedWineResults = normalizeAnswerResults(wineResults, 'wineName');
    const normalizedCategoryResults = normalizeAnswerResults(categoryResults, 'categoryId');
    const questionCorrect = Boolean(isCorrect);

    setProgress(previous => {
      if (isReadOnly) return previous;
      const nextWineProgress = { ...previous.wineProgress };
      normalizedWineResults.forEach(result => {
        nextWineProgress[result.wineName] = updateWineSchedule(
          previous.wineProgress[result.wineName],
          result.isCorrect,
          answeredDate
        );
      });

      const nextCategoryProgress = { ...previous.categoryProgress };
      normalizedCategoryResults.forEach(result => {
        const current = previous.categoryProgress[result.categoryId] || {
          timesCorrect: 0,
          timesIncorrect: 0
        };
        nextCategoryProgress[result.categoryId] = {
          ...current,
          timesCorrect: current.timesCorrect + (result.isCorrect ? 1 : 0),
          timesIncorrect: current.timesIncorrect + (result.isCorrect ? 0 : 1)
        };
      });

      const trackedAccuracy = previous.stats.trackedAccuracy;
      const byMode = { ...previous.stats.byMode };
      if (typeof mode === 'string' && mode.length > 0) {
        const currentMode = byMode[mode] || { correct: 0, answered: 0 };
        byMode[mode] = {
          correct: currentMode.correct + (questionCorrect ? 1 : 0),
          answered: currentMode.answered + 1
        };
      }

      return {
        ...previous,
        wineProgress: nextWineProgress,
        categoryProgress: nextCategoryProgress,
        stats: {
          ...previous.stats,
          totalQuestions: previous.stats.totalQuestions + 1,
          trackedAccuracy: {
            correct: trackedAccuracy.correct + (questionCorrect ? 1 : 0),
            answered: trackedAccuracy.answered + 1,
            startedAt: trackedAccuracy.startedAt || answeredIso
          },
          byMode
        }
      };
    });
  }, [isReadOnly]);

  const completeQuiz = useCallback(({
    sessionId,
    completedAt,
    kind = 'practice'
  } = {}) => {
    if (isReadOnly || storageContainsFutureProgress()) {
      setIsReadOnly(true);
      return;
    }
    const completedDate = safeDate(completedAt);
    const dateKey = getLocalDateKey(completedDate);

    setProgress(previous => {
      if (isReadOnly) return previous;
      const completedSessionIds = previous.stats.completedSessionIds;
      if (sessionId && completedSessionIds.includes(sessionId)) {
        return previous;
      }

      const lastDate = previous.streakData.lastQuizDate;
      const difference = lastDate ? dateKeyDifference(dateKey, lastDate) : null;
      let currentStreak = previous.streakData.currentStreak;
      if (!lastDate || difference > 1 || difference < 0) {
        currentStreak = 1;
      } else if (difference === 1) {
        currentStreak += 1;
      }

      const activityDates = [...new Set([
        ...previous.streakData.activityDates,
        dateKey
      ])].sort();

      return {
        ...previous,
        streakData: {
          ...previous.streakData,
          currentStreak,
          longestStreak: Math.max(currentStreak, previous.streakData.longestStreak),
          lastQuizDate: dateKey,
          activityDates
        },
        stats: {
          ...previous.stats,
          totalQuizzes: previous.stats.totalQuizzes + 1,
          lastSessionKind: kind,
          completedSessionIds: sessionId
            ? [...completedSessionIds, sessionId].slice(-100)
            : completedSessionIds
        }
      };
    });
  }, [isReadOnly]);

  const updateSettings = useCallback((newSettings) => {
    if (isReadOnly || storageContainsFutureProgress()) {
      setIsReadOnly(true);
      return;
    }
    setProgress(previous => ({
      ...previous,
      settings: normalizeProgressSettings({
        ...previous.settings,
        ...newSettings
      })
    }));
  }, [isReadOnly]);

  const toggleDarkMode = useCallback(() => {
    if (isReadOnly || storageContainsFutureProgress()) {
      setIsReadOnly(true);
      return;
    }
    setProgress(previous => ({
      ...previous,
      settings: {
        ...previous.settings,
        darkMode: !previous.settings.darkMode
      }
    }));
  }, [isReadOnly]);

  const resetProgress = useCallback(() => {
    localStorage.removeItem(PROGRESS_KEY);
    setProgress(createDefaultProgress());
    setIsReadOnly(false);
  }, []);

  const exportProgress = useCallback(() => {
    const preservedProgress = isReadOnly
      ? localStorage.getItem(PROGRESS_KEY)
      : null;
    const dataStr = preservedProgress || JSON.stringify(progress, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wine-quiz-progress-${getLocalDateKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [isReadOnly, progress]);

  const importProgress = useCallback((jsonData) => {
    const imported = parseProgressImport(jsonData);
    if (!imported) return false;
    localStorage.removeItem(PROGRESS_KEY);
    setProgress(imported);
    setIsReadOnly(false);
    return true;
  }, []);

  const markWineStudyStatus = useCallback((wineName, status) => {
    if (isReadOnly || storageContainsFutureProgress()) {
      setIsReadOnly(true);
      return;
    }
    setProgress(previous => {
      const wineData = previous.wineProgress[wineName] || {
        timesCorrect: 0,
        timesIncorrect: 0,
        lastSeen: null,
        nextReview: null,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        lapses: 0
      };

      return {
        ...previous,
        wineProgress: {
          ...previous.wineProgress,
          [wineName]: {
            ...wineData,
            studyStatus: status
          }
        }
      };
    });
  }, [isReadOnly]);

  return {
    progress,
    isReadOnly,
    recordQuizAnswer,
    completeQuiz,
    updateSettings,
    toggleDarkMode,
    resetProgress,
    exportProgress,
    importProgress,
    markWineStudyStatus
  };
}
