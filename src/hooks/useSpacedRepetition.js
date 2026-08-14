import { useCallback, useMemo, useState } from 'react';
import {
  getSpacedRepetitionSummary,
  selectDueWines,
  updateWineSchedule
} from '../utils/spacedRepetition';

/**
 * Thin React wrapper around the pure spaced-repetition helpers.
 *
 * Pass `{ now }` with a Date, timestamp, ISO string, or function returning one
 * to keep a render deterministic in tests or long-lived study sessions.
 */
export function useSpacedRepetition(wineProgress, allWines, { now: injectedNow } = {}) {
  const [defaultNow] = useState(Date.now);
  const now = typeof injectedNow === 'function'
    ? injectedNow()
    : injectedNow ?? defaultNow;
  const nowKey = now instanceof Date ? now.getTime() : now;

  const winesDueForReview = useMemo(
    () => selectDueWines(wineProgress, allWines, nowKey),
    [wineProgress, allWines, nowKey]
  );

  const summary = useMemo(
    () => getSpacedRepetitionSummary(wineProgress, allWines, nowKey),
    [wineProgress, allWines, nowKey]
  );

  const getNextWine = useCallback((excludeWines = []) => {
    const excluded = new Set(excludeWines);
    return winesDueForReview.find(wine => !excluded.has(wine.name)) || null;
  }, [winesDueForReview]);

  const updateSchedule = useCallback((currentProgress, isCorrect, answerNow = Date.now()) => {
    return updateWineSchedule(currentProgress, isCorrect, answerNow);
  }, []);

  // Preserve the previous callback signature while delegating to the pure API.
  const calculateUpdatedProgress = useCallback((wineName, isCorrect, currentProgress, answerNow = Date.now()) => {
    void wineName;
    return updateWineSchedule(currentProgress, isCorrect, answerNow);
  }, []);

  return {
    winesDueForReview,
    dueWines: winesDueForReview,
    getNextWine,
    updateWineSchedule: updateSchedule,
    calculateUpdatedProgress,
    getStudyStats: summary,
    summary
  };
}
