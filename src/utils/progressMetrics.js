import {
  hasAttemptedWine,
  normalizeWineProgress
} from './spacedRepetition';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCounter(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function normalizeNow(now = new Date()) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('now must be a valid date.');
  }
  return date;
}

function toLocalDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function formatLocalDateKey(date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(value) {
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addLocalDays(date, amount) {
  const result = toLocalDate(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getActivityDateMap(activityDates, latestDate) {
  if (!Array.isArray(activityDates)) return new Map();

  const latestKey = latestDate ? formatLocalDateKey(latestDate) : null;
  const entries = activityDates.flatMap(value => {
    const date = parseLocalDateKey(value);
    if (!date) return [];

    const key = formatLocalDateKey(date);
    if (latestKey && key > latestKey) return [];
    return [[key, date]];
  });

  return new Map(entries);
}

function calculateStreak(activityDates, now, savedStreak = {}) {
  const today = toLocalDate(now);
  const activityDateMap = getActivityDateMap(activityDates, today);
  const activityKeys = new Set(activityDateMap.keys());
  const sortedDates = [...activityDateMap.values()].sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let previousDate = null;

  for (const date of sortedDates) {
    const followsPrevious = previousDate &&
      formatLocalDateKey(date) === formatLocalDateKey(addLocalDays(previousDate, 1));
    run = followsPrevious ? run + 1 : 1;
    longest = Math.max(longest, run);
    previousDate = date;
  }

  let cursor = today;
  if (!activityKeys.has(formatLocalDateKey(cursor))) {
    cursor = addLocalDays(cursor, -1);
  }

  let current = 0;
  while (activityKeys.has(formatLocalDateKey(cursor))) {
    current += 1;
    cursor = addLocalDays(cursor, -1);
  }

  const savedLastDate = parseLocalDateKey(savedStreak.lastQuizDate);
  const savedLastKey = savedLastDate ? formatLocalDateKey(savedLastDate) : null;
  const todayKey = formatLocalDateKey(today);
  const yesterdayKey = formatLocalDateKey(addLocalDays(today, -1));
  const savedStreakIsCurrent = savedLastKey === todayKey || savedLastKey === yesterdayKey;
  const preservedCurrent = savedStreakIsCurrent
    ? normalizeCounter(savedStreak.currentStreak)
    : 0;
  const finalCurrent = Math.max(current, preservedCurrent);

  return {
    current: finalCurrent,
    longest: Math.max(
      longest,
      finalCurrent,
      normalizeCounter(savedStreak.longestStreak)
    )
  };
}

function readCatalog(wineData) {
  const styles = Array.isArray(wineData?.styles)
    ? wineData.styles.filter(isRecord)
    : [];
  const wineNames = [];
  const seenWineNames = new Set();

  const categories = styles.map(style => {
    const categoryWineNames = [...new Set(
      (Array.isArray(style.wines) ? style.wines : [])
        .map(wine => wine?.name)
        .filter(name => typeof name === 'string' && name.length > 0)
    )];

    for (const wineName of categoryWineNames) {
      if (!seenWineNames.has(wineName)) {
        seenWineNames.add(wineName);
        wineNames.push(wineName);
      }
    }

    return {
      id: style.id,
      name: style.name,
      color: style.color,
      wineNames: categoryWineNames
    };
  });

  return { categories, wineNames };
}

function isPracticed(record) {
  if (!isRecord(record)) return false;

  const attempted = normalizeCounter(record.timesCorrect) +
    normalizeCounter(record.timesIncorrect) > 0;
  const hasStudyStatus = typeof record.studyStatus === 'string' &&
    record.studyStatus.trim().length > 0;
  return attempted || hasStudyStatus;
}

function readReviewTime(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function buildActivityCalendar(activityDates, now = new Date(), days = 30) {
  if (!Number.isInteger(days) || days <= 0) {
    throw new RangeError('days must be a positive integer.');
  }

  const today = toLocalDate(normalizeNow(now));
  const activityKeys = new Set(getActivityDateMap(activityDates).keys());

  return Array.from({ length: days }, (_, index) => {
    const date = addLocalDays(today, index - days + 1);
    const key = formatLocalDateKey(date);
    return {
      date: key,
      day: date.getDate(),
      isActive: activityKeys.has(key),
      isToday: index === days - 1
    };
  });
}

export function getProgressSummary(progress, wineData, now = new Date()) {
  const currentTime = normalizeNow(now);
  const value = isRecord(progress) ? progress : {};
  const wineProgress = isRecord(value.wineProgress) ? value.wineProgress : {};
  const stats = isRecord(value.stats) ? value.stats : {};
  const trackedAccuracy = isRecord(stats.trackedAccuracy) ? stats.trackedAccuracy : {};
  const streakData = isRecord(value.streakData) ? value.streakData : {};
  const { categories, wineNames } = readCatalog(wineData);
  const practicedWineNames = new Set(
    wineNames.filter(wineName => isPracticed(wineProgress[wineName]))
  );

  const dueWines = [];
  let scheduledCount = 0;
  let nextDueTime = null;
  for (const wineName of wineNames) {
    if (!hasAttemptedWine(wineProgress[wineName])) continue;
    const schedule = normalizeWineProgress(wineProgress[wineName]);
    const reviewTime = readReviewTime(schedule.nextReview);
    if (reviewTime === null || reviewTime <= currentTime.getTime()) {
      dueWines.push(wineName);
    } else {
      scheduledCount += 1;
      if (nextDueTime === null || reviewTime < nextDueTime) {
        nextDueTime = reviewTime;
      }
    }
  }

  const totalQuestions = normalizeCounter(stats.totalQuestions);
  const answered = normalizeCounter(trackedAccuracy.answered);
  const correct = Math.min(normalizeCounter(trackedAccuracy.correct), answered);
  const accuracyPercent = answered > 0
    ? Math.round((correct / answered) * 100)
    : null;

  return {
    catalogTotal: wineNames.length,
    practicedCount: practicedWineNames.size,
    dueWines,
    dueCount: dueWines.length,
    scheduledCount: dueWines.length + scheduledCount,
    nextDueAt: nextDueTime === null ? null : new Date(nextDueTime).toISOString(),
    accuracyPercent,
    totalQuestions,
    untrackedQuestionCount: Math.max(totalQuestions - answered, 0),
    streak: calculateStreak(streakData.activityDates, currentTime, streakData),
    categoryCoverage: categories.map(category => ({
      id: category.id,
      name: category.name,
      color: category.color,
      practiced: category.wineNames.filter(wineName => practicedWineNames.has(wineName)).length,
      total: category.wineNames.length
    }))
  };
}
