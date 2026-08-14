import { useState, useRef } from 'react';
import { QUIZ_MODES, QUIZ_QUESTION_COUNTS } from '../quiz/quizModes';

const difficultyOptions = [
  { id: 'easy', name: 'Easy', description: '3 options per question' },
  { id: 'medium', name: 'Medium', description: '4 options per question' },
  { id: 'hard', name: 'Hard', description: '5 options per question' }
];

export function Settings({
  settings,
  onUpdateSettings,
  onResetProgress,
  onExportProgress,
  onImportProgress,
  onToggleDarkMode,
  darkMode
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleModeToggle = (modeId) => {
    const newModes = settings.enabledModes.includes(modeId)
      ? settings.enabledModes.filter(m => m !== modeId)
      : [...settings.enabledModes, modeId];

    // Ensure at least one mode is enabled
    if (newModes.length > 0) {
      onUpdateSettings({ enabledModes: newModes });
    }
  };

  const handleDifficultyChange = (difficulty) => {
    onUpdateSettings({ difficulty });
  };

  const handleQuestionCountChange = (count) => {
    onUpdateSettings({ questionsPerSession: count });
  };

  const handleReset = () => {
    onResetProgress();
    setShowResetConfirm(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = onImportProgress(event.target.result);
        if (result) {
          setImportSuccess(true);
          setImportError(null);
          setTimeout(() => setImportSuccess(false), 3000);
        } else {
          setImportError('Invalid progress file format');
        }
      } catch {
        setImportError('Failed to read progress file');
      }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = '';
  };

  return (
    <div className={`settings ${darkMode ? 'dark' : ''}`}>
      <h2>Settings</h2>

      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="setting-item">
          <label className="setting-label">
            <span>Dark Mode</span>
            <button
              className={`toggle-btn ${darkMode ? 'active' : ''}`}
              onClick={onToggleDarkMode}
              aria-pressed={darkMode}
              aria-label="Dark mode"
            >
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </button>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h3>Quiz Modes</h3>
        <p className="section-description">Enable or disable quiz modes</p>
        <div className="mode-toggles">
          {QUIZ_MODES.map(mode => (
            <label key={mode.id} className="setting-item checkbox-item">
              <input
                type="checkbox"
                checked={settings.enabledModes.includes(mode.id)}
                onChange={() => handleModeToggle(mode.id)}
              />
              <span>{mode.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Difficulty</h3>
        <div className="difficulty-options">
          {difficultyOptions.map(option => (
            <button
              key={option.id}
              className={`difficulty-btn ${settings.difficulty === option.id ? 'selected' : ''}`}
              onClick={() => handleDifficultyChange(option.id)}
              aria-pressed={settings.difficulty === option.id}
            >
              <span className="difficulty-name">{option.name}</span>
              <span className="difficulty-desc">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Default Questions per Session</h3>
        <div className="question-count-options">
          {QUIZ_QUESTION_COUNTS.map(count => (
            <button
              key={count}
              className={`count-btn ${settings.questionsPerSession === count ? 'selected' : ''}`}
              onClick={() => handleQuestionCountChange(count)}
              aria-pressed={settings.questionsPerSession === count}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Data Management</h3>

        <div className="data-actions">
          <button className="action-btn export" onClick={onExportProgress}>
            Export Progress
          </button>

          <button className="action-btn import" onClick={handleImportClick}>
            Import Progress
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {importError && (
            <p className="error-message">{importError}</p>
          )}
          {importSuccess && (
            <p className="success-message">Progress imported successfully!</p>
          )}
        </div>

        <div className="danger-zone">
          {!showResetConfirm ? (
            <button
              className="action-btn danger"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset All Progress
            </button>
          ) : (
            <div className="confirm-reset">
              <p>Are you sure? This cannot be undone.</p>
              <div className="confirm-buttons">
                <button className="action-btn danger" onClick={handleReset}>
                  Yes, Reset
                </button>
                <button
                  className="action-btn cancel"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section about">
        <h3>About</h3>
        <p>Wine Quiz App - Learn wine categories and varietals</p>
        <p className="version">Version 1.0</p>
      </section>
    </div>
  );
}
