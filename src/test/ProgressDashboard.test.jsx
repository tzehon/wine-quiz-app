import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressDashboard } from '../components/ProgressDashboard'

const wineData = {
  styles: [
    {
      id: 'sparkling',
      name: 'Sparkling Wine',
      color: '#eee',
      wines: [{ name: 'Cava' }, { name: 'Champagne' }],
    },
  ],
}

function createProgress(overrides = {}) {
  return {
    wineProgress: {},
    categoryProgress: {},
    streakData: {
      currentStreak: 0,
      longestStreak: 0,
      lastQuizDate: null,
      activityDates: [],
    },
    stats: {
      totalQuizzes: 0,
      totalQuestions: 0,
      trackedAccuracy: { correct: 0, answered: 0, startedAt: null },
    },
    ...overrides,
  }
}

describe('ProgressDashboard', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not invent accuracy or mastery for legacy progress', () => {
    render(
      <ProgressDashboard
        progress={createProgress({
          wineProgress: { Cava: { timesCorrect: 5, timesIncorrect: 1 } },
          categoryProgress: {
            sparkling: { timesCorrect: 5, timesIncorrect: 1 },
          },
          stats: {
            totalQuizzes: 3,
            totalQuestions: 12,
            trackedAccuracy: { correct: 0, answered: 0, startedAt: null },
          },
        })}
        wineData={wineData}
        darkMode={false}
      />,
    )

    expect(screen.getByText('Tracked Accuracy')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Answer a quiz to begin accuracy tracking')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText(/12 earlier questions predate accuracy tracking/i)).toBeInTheDocument()
    expect(screen.queryByText(/overall mastery/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/category mastery/i)).not.toBeInTheDocument()
  })

  it('shows tracked accuracy, due schedules, coverage, and all activity dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    const today = new Date()
    const localKey = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const { container } = render(
      <ProgressDashboard
        progress={createProgress({
          wineProgress: {
            Cava: {
              timesCorrect: 1,
              nextReview: new Date(Date.now() - 1_000).toISOString(),
              lastSeen: new Date(Date.now() - 86_400_000).toISOString(),
            },
          },
          categoryProgress: {
            sparkling: { timesCorrect: 1, timesIncorrect: 0 },
          },
          streakData: {
            currentStreak: 2,
            longestStreak: 2,
            lastQuizDate: localKey(today),
            activityDates: [localKey(yesterday), localKey(today)],
          },
          stats: {
            totalQuizzes: 2,
            totalQuestions: 5,
            trackedAccuracy: { correct: 4, answered: 5, startedAt: '2026-08-01' },
          },
        })}
        wineData={wineData}
        darkMode={false}
      />,
    )

    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('Accuracy since tracking began')).toBeInTheDocument()
    expect(screen.getByText('50% practiced')).toBeInTheDocument()
    expect(screen.getByText('1 correct / 0 incorrect')).toBeInTheDocument()
    const streakCard = screen.getByText('Day Streak').closest('.stat-card')
    expect(within(streakCard).getByText('2')).toBeInTheDocument()
    expect(within(streakCard).getByText('Best: 2')).toBeInTheDocument()

    const dueCard = screen.getByText('Style Reviews Due').closest('.stat-card')
    expect(within(dueCard).getByText('1')).toBeInTheDocument()
    expect(within(dueCard).getByText('1 scheduled')).toBeInTheDocument()

    const completedStat = screen.getByText('Completed Sessions').closest('.quiz-stat')
    expect(within(completedStat).getByText('2')).toBeInTheDocument()
    const questionStat = screen.getByText('Questions Answered').closest('.quiz-stat')
    expect(within(questionStat).getByText('5')).toBeInTheDocument()
    const trackedStat = screen.getByText('Accuracy Tracked').closest('.quiz-stat')
    expect(within(trackedStat).getByText('5')).toBeInTheDocument()
    expect(container.querySelectorAll('.calendar-day.active')).toHaveLength(2)
  })
})
