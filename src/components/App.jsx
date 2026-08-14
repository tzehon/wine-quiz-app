import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigation } from './Navigation';
import { Home } from './Home';
import { QuizModeSelector } from './QuizModeSelector';
import { QuizEngine } from './QuizEngine';
import { QuizResults } from './QuizResults';
import { StudyMode } from './StudyMode';
import { ProgressDashboard } from './ProgressDashboard';
import { Settings } from './Settings';
import { useWineData } from '../hooks/useWineData';
import { useProgress } from '../hooks/useProgress';
import { selectDueWines } from '../utils/spacedRepetition';

function createSessionId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `quiz-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function App() {
  const [currentView, setCurrentView] = useState('home');
  const [quizState, setQuizState] = useState('idle'); // idle, configuring, playing, results
  const [quizConfig, setQuizConfig] = useState({
    selectedModes: [],
    selectedCategories: [],
    questionCount: 10,
    sessionKind: 'practice',
    sessionId: null,
    targetWineNames: []
  });
  const [quizResults, setQuizResults] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const {
    wineData,
    pronunciations,
    loading,
    error,
    lastUpdated,
    refresh,
    getAllStyles,
    getAllWines
  } = useWineData();

  const {
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
  } = useProgress();
  const allWines = useMemo(() => getAllWines(), [getAllWines]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Apply dark mode to document
  useEffect(() => {
    document.body.classList.toggle('dark-mode', progress.settings.darkMode);
  }, [progress.settings.darkMode]);

  const openQuizConfigurator = useCallback(() => {
    setQuizConfig({
      selectedModes: [...progress.settings.enabledModes],
      selectedCategories: getAllStyles().map(style => style.id),
      questionCount: progress.settings.questionsPerSession,
      sessionKind: 'practice',
      sessionId: null,
      targetWineNames: []
    });
    setCurrentView('quiz');
    setQuizState('configuring');
  }, [getAllStyles, progress.settings.enabledModes, progress.settings.questionsPerSession]);

  const handleNavigate = useCallback((view) => {
    if (view === 'quiz') {
      openQuizConfigurator();
      return;
    }

    setCurrentView(view);
    setQuizState('idle');
  }, [openQuizConfigurator]);

  const handleBeginQuiz = useCallback(() => {
    setQuizConfig(previous => ({
      ...previous,
      sessionKind: 'practice',
      sessionId: createSessionId(),
      targetWineNames: []
    }));
    setQuizState('playing');
  }, []);

  const handleQuizAnswer = useCallback((outcome) => {
    recordQuizAnswer(outcome);
  }, [recordQuizAnswer]);

  const handleQuizComplete = useCallback((results) => {
    setQuizResults(results);
    setQuizState('results');
    completeQuiz({
      sessionId: results.sessionId,
      kind: results.sessionKind,
      score: results.score,
      total: results.total,
      completedAt: new Date().toISOString()
    });
  }, [completeQuiz]);

  const handleStartReview = useCallback(() => {
    const dueWineNames = selectDueWines(
      progress.wineProgress,
      allWines,
      new Date()
    )
      .map(wine => typeof wine === 'string' ? wine : wine.name)
      .slice(0, progress.settings.questionsPerSession);

    if (dueWineNames.length === 0) return;

    setQuizConfig({
      selectedModes: ['category-match'],
      selectedCategories: [],
      questionCount: dueWineNames.length,
      sessionKind: 'review',
      sessionId: createSessionId(),
      targetWineNames: dueWineNames
    });
    setQuizResults(null);
    setCurrentView('quiz');
    setQuizState('playing');
  }, [allWines, progress.settings.questionsPerSession, progress.wineProgress]);

  const handleExitQuiz = useCallback(() => {
    setQuizState('idle');
    setCurrentView('home');
  }, []);

  const handlePlayAgain = useCallback(() => {
    openQuizConfigurator();
  }, [openQuizConfigurator]);

  const handleRetryMistakes = useCallback((wineNames) => {
    const targets = [...new Set(wineNames)].filter(Boolean);
    if (targets.length === 0) return;

    setQuizConfig({
      selectedModes: ['category-match'],
      selectedCategories: [],
      questionCount: targets.length,
      sessionKind: 'review',
      sessionId: createSessionId(),
      targetWineNames: targets
    });
    setQuizState('playing');
  }, []);

  const renderContent = () => {
    if (loading && !wineData) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading wine data...</p>
        </div>
      );
    }

    if (error && !wineData) {
      return (
        <div className="error-screen">
          <p>Error: {error}</p>
          <button onClick={refresh}>Retry</button>
        </div>
      );
    }

    // Quiz flow
    if (currentView === 'quiz') {
      if (quizState === 'configuring') {
        return (
          <QuizModeSelector
            enabledModes={progress.settings.enabledModes}
            selectedModes={quizConfig.selectedModes}
            onModesChange={(modes) => setQuizConfig(prev => ({ ...prev, selectedModes: modes }))}
            categories={getAllStyles()}
            selectedCategories={quizConfig.selectedCategories}
            onCategoriesChange={(cats) => setQuizConfig(prev => ({ ...prev, selectedCategories: cats }))}
            questionCount={quizConfig.questionCount}
            onQuestionCountChange={(count) => setQuizConfig(prev => ({ ...prev, questionCount: count }))}
            onStartQuiz={handleBeginQuiz}
            darkMode={progress.settings.darkMode}
          />
        );
      }

      if (quizState === 'playing') {
        return (
          <QuizEngine
            selectedModes={quizConfig.selectedModes}
            selectedCategories={quizConfig.selectedCategories}
            questionCount={quizConfig.questionCount}
            wineData={wineData}
            difficulty={progress.settings.difficulty}
            sessionKind={quizConfig.sessionKind}
            sessionId={quizConfig.sessionId}
            targetWineNames={quizConfig.targetWineNames}
            onAnswer={handleQuizAnswer}
            onComplete={handleQuizComplete}
            onExit={handleExitQuiz}
            onReconfigure={openQuizConfigurator}
            darkMode={progress.settings.darkMode}
            onToggleDarkMode={() => updateSettings({ darkMode: !progress.settings.darkMode })}
          />
        );
      }

      if (quizState === 'results') {
        return (
          <QuizResults
            results={quizResults}
            onPlayAgain={handlePlayAgain}
            onRetryMistakes={handleRetryMistakes}
            onGoHome={handleExitQuiz}
            sessionKind={quizResults.sessionKind}
            darkMode={progress.settings.darkMode}
          />
        );
      }
    }

    switch (currentView) {
      case 'study':
        return (
          <StudyMode
            wineData={wineData}
            pronunciations={pronunciations}
            progress={progress}
            onMarkStudyStatus={markWineStudyStatus}
            darkMode={progress.settings.darkMode}
          />
        );

      case 'progress':
        return (
          <ProgressDashboard
            progress={progress}
            wineData={wineData}
            darkMode={progress.settings.darkMode}
          />
        );

      case 'settings':
        return (
          <Settings
            settings={progress.settings}
            isReadOnly={isReadOnly}
            onUpdateSettings={updateSettings}
            onResetProgress={resetProgress}
            onExportProgress={exportProgress}
            onImportProgress={importProgress}
            onToggleDarkMode={toggleDarkMode}
            darkMode={progress.settings.darkMode}
          />
        );

      default:
        return (
          <Home
            progress={progress}
            wineData={wineData}
            isReadOnly={isReadOnly}
            onStartQuiz={openQuizConfigurator}
            onStartReview={handleStartReview}
            onNavigate={handleNavigate}
            darkMode={progress.settings.darkMode}
          />
        );
    }
  };

  return (
    <div className={`app ${progress.settings.darkMode ? 'dark' : ''}`}>
      {isReadOnly && (
        <div className="offline-banner" role="status">
          Progress was created by a newer app version. This copy is read-only to keep it safe.
        </div>
      )}
      {!isOnline && (
        <div className="offline-banner">
          Offline - Using cached data
        </div>
      )}

      {quizState !== 'playing' && (
        <Navigation
          currentView={currentView}
          onNavigate={handleNavigate}
          darkMode={progress.settings.darkMode}
          onToggleDarkMode={() => updateSettings({ darkMode: !progress.settings.darkMode })}
        />
      )}

      <main className="main-content">
        {renderContent()}
      </main>

      {lastUpdated && quizState !== 'playing' && (
        <footer className="app-footer">
          <span>Data updated: {lastUpdated}</span>
          {isOnline && (
            <button className="refresh-btn" onClick={refresh}>
              Refresh
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
