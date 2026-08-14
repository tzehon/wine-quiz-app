import { useState, useCallback } from 'react';
import {
  generateQuizQuestions,
  QuizConfigurationError
} from '../quiz/generateQuizQuestions';
import { CategoryMatch } from '../quizModes/CategoryMatch';
import { WineSelection } from '../quizModes/WineSelection';
import { QuickFire } from '../quizModes/QuickFire';
import { DescriptionMatch } from '../quizModes/DescriptionMatch';
import { OddOneOut } from '../quizModes/OddOneOut';
import { OriginMatch } from '../quizModes/OriginMatch';

export function QuizEngine({
  selectedModes,
  selectedCategories,
  questionCount,
  wineData,
  difficulty,
  onAnswer,
  onComplete,
  onExit,
  onReconfigure,
  darkMode,
  onToggleDarkMode
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [{ questions, generationError }] = useState(() => {
    try {
      return {
        questions: generateQuizQuestions({
          selectedModes,
          selectedCategories,
          questionCount,
          wineData,
          difficulty
        }),
        generationError: null
      };
    } catch (error) {
      return {
        questions: [],
        generationError: error instanceof QuizConfigurationError
          ? error.errors.join(' ')
          : 'Questions could not be generated. Please change the quiz settings and try again.'
      };
    }
  });

  const handleAnswer = useCallback((answer, isCorrect, details) => {
    setLastAnswer({ answer, isCorrect, details });
    setShowFeedback(true);

    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setAnswers(prev => [...prev, {
      question: questions[currentQuestion],
      answer,
      isCorrect,
      details
    }]);

    onAnswer(details.wineName || details.categoryId, isCorrect, details);
  }, [currentQuestion, questions, onAnswer]);

  const handleNext = useCallback(() => {
    setShowFeedback(false);
    setLastAnswer(null);

    if (currentQuestion + 1 >= questions.length) {
      onComplete({
        score,
        total: questions.length,
        answers
      });
    } else {
      setCurrentQuestion(prev => prev + 1);
    }
  }, [currentQuestion, questions.length, score, answers, onComplete]);

  if (generationError || questions.length === 0) {
    return (
      <div className={`quiz-engine error-screen ${darkMode ? 'dark' : ''}`} role="alert">
        <h2>Unable to start this quiz</h2>
        <p>{generationError || 'No questions are available for this configuration.'}</p>
        <div className="quiz-error-actions">
          <button className="primary-btn" onClick={onReconfigure}>
            Change Settings
          </button>
          <button className="secondary-btn" onClick={onExit}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  const renderQuestion = () => {
    const commonProps = {
      question,
      onAnswer: handleAnswer,
      showFeedback,
      lastAnswer,
      darkMode
    };

    switch (question.mode) {
      case 'category-match':
        return <CategoryMatch key={question.id} {...commonProps} />;
      case 'wine-selection':
        return <WineSelection key={question.id} {...commonProps} />;
      case 'quick-fire':
        return <QuickFire key={question.id} {...commonProps} onTimeUp={handleAnswer} />;
      case 'description-match':
        return <DescriptionMatch key={question.id} {...commonProps} />;
      case 'odd-one-out':
        return <OddOneOut key={question.id} {...commonProps} />;
      case 'origin-match':
        return <OriginMatch key={question.id} {...commonProps} />;
      default:
        return <p>Unknown question type</p>;
    }
  };

  return (
    <div className={`quiz-engine ${darkMode ? 'dark' : ''}`}>
      <div className="quiz-header">
        <button className="exit-btn" onClick={onExit}>
          Exit
        </button>
        <div className="quiz-progress">
          <span className="progress-text">
            {currentQuestion + 1} / {questions.length}
          </span>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label="Quiz progress"
            aria-valuemin="1"
            aria-valuemax={questions.length}
            aria-valuenow={currentQuestion + 1}
          >
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="quiz-score">
          Score: {score}
        </div>
        <button
          className="dark-mode-toggle-btn"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="quiz-content">
        {renderQuestion()}
      </div>

      {showFeedback && (
        <div
          className={`feedback-overlay ${lastAnswer?.isCorrect ? 'correct' : 'incorrect'}`}
          role="status"
          aria-live="polite"
        >
          <div className="feedback-content">
            <div className="feedback-icon">
              {lastAnswer?.isCorrect ? '✓' : '✗'}
            </div>
            <div className="feedback-message">
              {lastAnswer?.isCorrect ? 'Correct!' : 'Incorrect'}
            </div>
            {lastAnswer?.details?.explanation && (
              <p className="feedback-explanation">{lastAnswer.details.explanation}</p>
            )}
            <button className="next-btn" onClick={handleNext}>
              {currentQuestion + 1 >= questions.length ? 'See Results' : 'Next Question'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
