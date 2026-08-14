import { useMemo } from 'react';
import { useCurrentTime } from '../hooks/useCurrentTime';
import {
  buildActivityCalendar,
  getProgressSummary
} from '../utils/progressMetrics';

export function ProgressDashboard({ progress, wineData, darkMode }) {
  const now = useCurrentTime();
  const stats = useMemo(
    () => getProgressSummary(progress, wineData, now),
    [now, progress, wineData]
  );
  const streakCalendar = useMemo(
    () => buildActivityCalendar(progress.streakData.activityDates, now),
    [now, progress.streakData.activityDates]
  );
  const trackedQuestions = stats.totalQuestions - stats.untrackedQuestionCount;

  return (
    <div className={`progress-dashboard ${darkMode ? 'dark' : ''}`}>
      <h2>Your Progress</h2>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-value">
            {stats.accuracyPercent === null ? '—' : `${stats.accuracyPercent}%`}
          </div>
          <div className="stat-label">Tracked Accuracy</div>
          <div className="stat-sublabel">
            {stats.accuracyPercent === null
              ? 'Answer a quiz to begin accuracy tracking'
              : 'Accuracy since tracking began'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.practicedCount}/{stats.catalogTotal}</div>
          <div className="stat-label">Wines Practiced</div>
        </div>

        <div className="stat-card streak">
          <div className="stat-value">{stats.streak.current}</div>
          <div className="stat-label">Day Streak</div>
          <div className="stat-sublabel">Best: {stats.streak.longest}</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.dueCount}</div>
          <div className="stat-label">Style Reviews Due</div>
          <div className="stat-sublabel">{stats.scheduledCount} scheduled</div>
        </div>
      </div>

      <section className="progress-section">
        <h3>Category Practice</h3>
        <div className="category-progress-list">
          {stats.categoryCoverage.map(category => {
            const practicePercent = category.total > 0
              ? Math.round((category.practiced / category.total) * 100)
              : 0;
            const answerStats = progress.categoryProgress[category.id];

            return (
              <div key={category.id} className="category-progress-item">
                <div className="category-header">
                  <span
                    className="category-dot"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="category-name">{category.name}</span>
                  <span className="category-stats">
                    {category.practiced}/{category.total} wines
                  </span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${practicePercent}%`,
                      backgroundColor: category.color
                    }}
                  />
                </div>
                <div className="category-footer">
                  <span className="mastery-percent">{practicePercent}% practiced</span>
                  <span className="answer-stats">
                    {answerStats?.timesCorrect || 0} correct / {answerStats?.timesIncorrect || 0} incorrect
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="progress-section">
        <h3>Activity Calendar</h3>
        <div className="streak-calendar">
          {streakCalendar.map(day => (
            <div
              key={day.date}
              className={`calendar-day ${day.isActive ? 'active' : ''} ${day.isToday ? 'today' : ''}`}
              title={day.date}
            >
              {day.day}
            </div>
          ))}
        </div>
      </section>

      <section className="progress-section">
        <h3>Quiz Statistics</h3>
        <div className="quiz-stats">
          <div className="quiz-stat">
            <span className="quiz-stat-value">{progress.stats.totalQuizzes}</span>
            <span className="quiz-stat-label">Completed Sessions</span>
          </div>
          <div className="quiz-stat">
            <span className="quiz-stat-value">{stats.totalQuestions}</span>
            <span className="quiz-stat-label">Questions Answered</span>
          </div>
          <div className="quiz-stat">
            <span className="quiz-stat-value">{trackedQuestions}</span>
            <span className="quiz-stat-label">Accuracy Tracked</span>
          </div>
        </div>
        {stats.untrackedQuestionCount > 0 && (
          <p className="tracking-note">
            {stats.untrackedQuestionCount} earlier question{stats.untrackedQuestionCount === 1 ? '' : 's'} predate accuracy tracking.
          </p>
        )}
      </section>
    </div>
  );
}
