import { useMemo } from 'react';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { getProgressSummary } from '../utils/progressMetrics';

export function Home({
  progress,
  wineData,
  isReadOnly = false,
  onStartQuiz,
  onStartReview,
  onNavigate,
  darkMode
}) {
  const now = useCurrentTime();
  const stats = useMemo(
    () => getProgressSummary(progress, wineData, now),
    [now, progress, wineData]
  );

  return (
    <div className={`home ${darkMode ? 'dark' : ''}`}>
      <div className="hero">
        <div className="hero-icon">🍷</div>
        <h1>Wine Quiz</h1>
        <p>Master wine categories and varietals</p>
      </div>

      <div className="quick-stats">
        <div className="stat-item">
          <span className="stat-value">
            {stats.accuracyPercent === null ? '—' : `${stats.accuracyPercent}%`}
          </span>
          <span className="stat-label">Tracked Accuracy</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.practicedCount}/{stats.catalogTotal}</span>
          <span className="stat-label">Wines Practiced</span>
        </div>
        <div className="stat-item streak">
          <span className="stat-value">{stats.streak.current}</span>
          <span className="stat-label">Day Streak</span>
        </div>
      </div>

      <div className="action-buttons">
        <button className="primary-btn" onClick={onStartQuiz} disabled={isReadOnly}>
          <span className="btn-icon">🎯</span>
          <span className="btn-text">Start Quiz</span>
        </button>

        <button className="secondary-btn" onClick={() => onNavigate('study')} disabled={isReadOnly}>
          <span className="btn-icon">📚</span>
          <span className="btn-text">Study Mode</span>
        </button>

        <button className="secondary-btn" onClick={() => onNavigate('progress')}>
          <span className="btn-icon">📊</span>
          <span className="btn-text">View Progress</span>
        </button>
      </div>

      {stats.dueCount > 0 && (
        <button className="review-reminder" onClick={onStartReview} disabled={isReadOnly}>
          <span className="reminder-icon">📝</span>
          <span>Review {stats.dueCount} wine style{stats.dueCount === 1 ? '' : 's'}</span>
        </button>
      )}

      <div className="tip-of-day">
        <h3>Wine Categories</h3>
        <p>Wines are grouped by body and color: sparkling, light/full-bodied whites, aromatic whites, rosé, and light/medium-bodied reds. Each style has distinct characteristics!</p>
      </div>
    </div>
  );
}
