const navItems = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'quiz', label: 'Quiz', icon: '🎯' },
  { id: 'study', label: 'Study', icon: '📚' },
  { id: 'progress', label: 'Progress', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
];

export function Navigation({ currentView, onNavigate, darkMode, onToggleDarkMode }) {
  return (
    <nav className={`navigation ${darkMode ? 'dark' : ''}`}>
      <div className="nav-brand">
        <span className="brand-icon">🍷</span>
        <span className="brand-text">Wine Quiz</span>
      </div>
      <div className="nav-items">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={currentView === item.id ? 'page' : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
        <button
          className="nav-item dark-mode-toggle"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="nav-icon">{darkMode ? '☀️' : '🌙'}</span>
          <span className="nav-label">{darkMode ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </nav>
  );
}
