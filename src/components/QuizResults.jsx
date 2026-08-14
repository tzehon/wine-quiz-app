function getQuestionLabel(question) {
  return question.wine?.name ||
    question.style?.name ||
    question.oddWine ||
    question.statement ||
    question.description ||
    'Question';
}

function getRetryWineNames(answers) {
  return [...new Set(
    answers
      .map(answer => answer.question.wine?.name || answer.question.oddWine)
      .filter(Boolean)
  )];
}

export function QuizResults({
  results,
  sessionKind = 'practice',
  onPlayAgain,
  onRetryMistakes,
  onGoHome,
  darkMode
}) {
  const percentage = results.total > 0
    ? Math.round((results.score / results.total) * 100)
    : 0;

  const getMessage = () => {
    if (percentage === 100) return { emoji: '🏆', text: 'Perfect Score!' };
    if (percentage >= 80) return { emoji: '🌟', text: 'Excellent!' };
    if (percentage >= 60) return { emoji: '👍', text: 'Good Job!' };
    if (percentage >= 40) return { emoji: '📚', text: 'Keep Learning!' };
    return { emoji: '💪', text: 'Practice Makes Perfect!' };
  };

  const message = getMessage();

  // Group incorrect answers
  const incorrectAnswers = results.answers.filter(a => !a.isCorrect);
  const retryWineNames = getRetryWineNames(incorrectAnswers);

  return (
    <div className={`quiz-results ${darkMode ? 'dark' : ''}`}>
      <div className="results-header">
        <div className="result-emoji">{message.emoji}</div>
        <h2>{sessionKind === 'review' ? 'Review Complete' : message.text}</h2>
        {sessionKind === 'review' && (
          <p className="result-message">{message.text}</p>
        )}
        <div className="score-display">
          <span className="score-value">{results.score}</span>
          <span className="score-divider">/</span>
          <span className="score-total">{results.total}</span>
        </div>
        <div className="score-percentage">{percentage}%</div>
      </div>

      {incorrectAnswers.length > 0 && (
        <div className="review-section">
          <h3>Review These Answers</h3>
          <div className="review-list">
            {incorrectAnswers.map((answer) => (
              <div key={answer.question.id || getQuestionLabel(answer.question)} className="review-item">
                <div className="review-question">
                  {getQuestionLabel(answer.question)}
                </div>
                {answer.details?.explanation && (
                  <div className="review-explanation">
                    {answer.details.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="results-actions">
        {sessionKind === 'practice' && (
          <button className="primary-btn" onClick={onPlayAgain}>
            Play Again
          </button>
        )}
        {sessionKind === 'review' && retryWineNames.length > 0 && (
          <button
            className="primary-btn"
            onClick={() => onRetryMistakes?.(retryWineNames)}
          >
            Retry Mistakes
          </button>
        )}
        <button className="secondary-btn" onClick={onGoHome}>
          Go Home
        </button>
      </div>
    </div>
  );
}
