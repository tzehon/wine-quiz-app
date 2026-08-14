export const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const LAPSE_EASE_PENALTY = 0.2;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCounter(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function toTimestamp(value) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  return null;
}

function requireTimestamp(now) {
  const timestamp = toTimestamp(now);
  if (timestamp === null) {
    throw new TypeError('A valid current time must be provided.');
  }
  return timestamp;
}

function normalizeDate(value) {
  const timestamp = toTimestamp(value);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

function inferRepetitions(value, interval) {
  if (Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  // Legacy schedules did not store repetitions. Preserve their next interval
  // as closely as possible when importing an existing 1-day or later card.
  if (interval > 1) return 2;
  if (interval === 1) return 1;
  return 0;
}

/**
 * Return a safe, complete schedule while preserving unrelated wine metadata.
 */
export function normalizeWineProgress(progress) {
  const value = isRecord(progress) ? progress : {};
  const interval = normalizeCounter(value.interval);
  const easeFactor = Number.isFinite(value.easeFactor)
    ? Math.max(MIN_EASE_FACTOR, value.easeFactor)
    : DEFAULT_EASE_FACTOR;

  return {
    ...value,
    timesCorrect: normalizeCounter(value.timesCorrect),
    timesIncorrect: normalizeCounter(value.timesIncorrect),
    repetitions: inferRepetitions(value.repetitions, interval),
    interval,
    easeFactor,
    lapses: normalizeCounter(value.lapses),
    lastSeen: normalizeDate(value.lastSeen),
    nextReview: normalizeDate(value.nextReview)
  };
}

export const normalizeWineSchedule = normalizeWineProgress;

export function hasAttemptedWine(progress) {
  const normalized = normalizeWineProgress(progress);
  return normalized.timesCorrect > 0 ||
    normalized.timesIncorrect > 0 ||
    normalized.repetitions > 0 ||
    normalized.lapses > 0 ||
    normalized.lastSeen !== null;
}

/**
 * Apply one answer to a wine schedule.
 *
 * Correct answers follow the SM-2 interval sequence: 1 day, 6 days, then
 * round(previous interval * ease). Incorrect answers become due again in one
 * day, reset repetitions, record a lapse, and lower ease without going below
 * the SM-2 minimum.
 */
export function scheduleWineReview(progress, isCorrect, now) {
  const nowTimestamp = requireTimestamp(now);
  const current = normalizeWineProgress(progress);

  let repetitions;
  let interval;
  let easeFactor = current.easeFactor;
  let lapses = current.lapses;

  if (isCorrect === true) {
    repetitions = current.repetitions + 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(current.interval * current.easeFactor));
    }
  } else {
    repetitions = 0;
    interval = 1;
    lapses += 1;
    easeFactor = Math.max(MIN_EASE_FACTOR, current.easeFactor - LAPSE_EASE_PENALTY);
  }

  return {
    ...current,
    timesCorrect: current.timesCorrect + (isCorrect === true ? 1 : 0),
    timesIncorrect: current.timesIncorrect + (isCorrect === true ? 0 : 1),
    repetitions,
    interval,
    easeFactor,
    lapses,
    lastSeen: new Date(nowTimestamp).toISOString(),
    nextReview: new Date(nowTimestamp + interval * DAY_IN_MILLISECONDS).toISOString()
  };
}

export const scheduleWine = scheduleWineReview;
export const updateWineSchedule = scheduleWineReview;

function getCatalogWines(allWines) {
  if (!Array.isArray(allWines)) return [];

  const seenNames = new Set();
  return allWines.filter(wine => {
    if (!isRecord(wine) || typeof wine.name !== 'string' || !wine.name || seenNames.has(wine.name)) {
      return false;
    }
    seenNames.add(wine.name);
    return true;
  });
}

function getProgressForWine(wineProgress, wineName) {
  if (!isRecord(wineProgress) || !Object.hasOwn(wineProgress, wineName)) {
    return null;
  }
  return wineProgress[wineName];
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Select attempted catalog wines that are due now.
 *
 * Missing and invalid schedules are due. Unseen wines and progress records no
 * longer present in the catalog are intentionally excluded.
 */
export function getDueWines(wineProgress, allWines, now) {
  const nowTimestamp = requireTimestamp(now);
  const dueWines = [];

  getCatalogWines(allWines).forEach(wine => {
    const rawProgress = getProgressForWine(wineProgress, wine.name);
    if (!hasAttemptedWine(rawProgress)) return;

    const progress = normalizeWineProgress(rawProgress);
    const nextReviewTimestamp = toTimestamp(progress.nextReview);
    if (nextReviewTimestamp !== null && nextReviewTimestamp > nowTimestamp) return;

    const lastSeenTimestamp = toTimestamp(progress.lastSeen);
    const dueFromTimestamp = nextReviewTimestamp ?? lastSeenTimestamp ?? nowTimestamp;
    const overdueMilliseconds = Math.max(0, nowTimestamp - dueFromTimestamp);

    dueWines.push({
      ...wine,
      priority: 'due',
      overdueDays: Math.floor(overdueMilliseconds / DAY_IN_MILLISECONDS),
      overdueMilliseconds,
      progress
    });
  });

  return dueWines
    .sort((left, right) => {
      if (left.overdueMilliseconds !== right.overdueMilliseconds) {
        return right.overdueMilliseconds - left.overdueMilliseconds;
      }

      if (left.progress.lapses !== right.progress.lapses) {
        return right.progress.lapses - left.progress.lapses;
      }

      const leftLastSeen = toTimestamp(left.progress.lastSeen) ?? Number.POSITIVE_INFINITY;
      const rightLastSeen = toTimestamp(right.progress.lastSeen) ?? Number.POSITIVE_INFINITY;
      if (leftLastSeen !== rightLastSeen) {
        return leftLastSeen - rightLastSeen;
      }

      return compareStrings(left.name, right.name);
    });
}

export const selectDueWines = getDueWines;

/**
 * Summarize scheduling state for the current catalog only.
 */
export function getSpacedRepetitionSummary(wineProgress, allWines, now) {
  const nowTimestamp = requireTimestamp(now);
  const catalogWines = getCatalogWines(allWines);
  const dueForReview = getDueWines(wineProgress, catalogWines, nowTimestamp).length;
  let unseen = 0;
  let scheduled = 0;

  catalogWines.forEach(wine => {
    const rawProgress = getProgressForWine(wineProgress, wine.name);
    if (!hasAttemptedWine(rawProgress)) {
      unseen += 1;
      return;
    }

    const nextReviewTimestamp = toTimestamp(normalizeWineProgress(rawProgress).nextReview);
    if (nextReviewTimestamp !== null && nextReviewTimestamp > nowTimestamp) {
      scheduled += 1;
    }
  });

  return {
    dueForReview,
    scheduled,
    unseen,
    attempted: dueForReview + scheduled,
    total: catalogWines.length,
    // Compatibility aliases for the previous hook result.
    newWines: unseen,
    mastered: scheduled
  };
}

export const summarizeSpacedRepetition = getSpacedRepetitionSummary;
