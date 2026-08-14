import { getQuizConfigurationErrors } from '../quiz/generateQuizQuestions';
import { QUIZ_MODES, QUIZ_QUESTION_COUNTS } from '../quiz/quizModes';

export function QuizModeSelector({
  enabledModes,
  selectedModes,
  onModesChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  questionCount,
  onQuestionCountChange,
  onStartQuiz,
  darkMode
}) {
  const visibleModes = QUIZ_MODES.filter(mode => enabledModes.includes(mode.id));
  const visibleModeIds = visibleModes.map(mode => mode.id);
  const allModesSelected = visibleModeIds.length > 0 &&
    visibleModeIds.every(modeId => selectedModes.includes(modeId));
  const configurationErrors = getQuizConfigurationErrors({
    selectedModes,
    selectedCategories,
    wineData: { styles: categories },
    questionCount
  });

  const handleModeToggle = (modeId) => {
    if (selectedModes.includes(modeId)) {
      onModesChange(selectedModes.filter(m => m !== modeId));
    } else {
      onModesChange([...selectedModes, modeId]);
    }
  };

  const handleSelectAllModes = () => {
    onModesChange(allModesSelected ? [] : visibleModeIds);
  };

  const handleCategoryToggle = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoriesChange(selectedCategories.filter(c => c !== categoryId));
    } else {
      onCategoriesChange([...selectedCategories, categoryId]);
    }
  };

  const handleSelectAllCategories = () => {
    if (selectedCategories.length === categories.length) {
      onCategoriesChange([]);
    } else {
      onCategoriesChange(categories.map(c => c.id));
    }
  };

  const canStart = configurationErrors.length === 0;

  return (
    <div className={`quiz-mode-selector ${darkMode ? 'dark' : ''}`}>
      <h2>Configure Your Quiz</h2>

      <section className="selector-section">
        <div className="section-header">
          <h3>Quiz Modes</h3>
          <button
            className="select-all-btn"
            onClick={handleSelectAllModes}
          >
            {allModesSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="mode-grid">
          {visibleModes.map(mode => (
              <button
                key={mode.id}
                className={`mode-card ${selectedModes.includes(mode.id) ? 'selected' : ''}`}
                onClick={() => handleModeToggle(mode.id)}
                aria-pressed={selectedModes.includes(mode.id)}
              >
                <span className="mode-icon">{mode.icon}</span>
                <span className="mode-name">{mode.name}</span>
                <span className="mode-desc">{mode.description}</span>
              </button>
            ))}
        </div>
      </section>

      <section className="selector-section">
        <div className="section-header">
          <h3>Focus Categories</h3>
          <button
            className="select-all-btn"
            onClick={handleSelectAllCategories}
          >
            {selectedCategories.length === categories.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="category-grid">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-chip ${selectedCategories.includes(category.id) ? 'selected' : ''}`}
              onClick={() => handleCategoryToggle(category.id)}
              aria-pressed={selectedCategories.includes(category.id)}
              style={{
                '--category-color': category.color,
                backgroundColor: selectedCategories.includes(category.id) ? category.color : 'transparent'
              }}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section className="selector-section">
        <h3>Questions</h3>
        <div className="question-count-selector">
          {QUIZ_QUESTION_COUNTS.map(count => (
            <button
              key={count}
              className={`count-btn ${questionCount === count ? 'selected' : ''}`}
              onClick={() => onQuestionCountChange(count)}
              aria-pressed={questionCount === count}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      {configurationErrors.length > 0 && (
        <div className="quiz-config-errors" role="alert">
          {configurationErrors.map(error => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <button
        className="start-quiz-btn"
        onClick={onStartQuiz}
        disabled={!canStart}
      >
        Start Quiz
      </button>
    </div>
  );
}
