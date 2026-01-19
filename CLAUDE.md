# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev        # Start Vite dev server with hot reload
npm run build      # Production build (outputs to dist/)
npm run lint       # ESLint on all .js/.jsx files
npm run preview    # Preview production build locally
```

No test framework is configured.

## Architecture Overview

This is a React 19 + Vite static site quiz app for wine education. No backend - all data comes from static JSON files in `/public/data/` and progress is persisted to localStorage.

### Core State Flow

**App.jsx** is the central orchestrator managing:
- View routing (home, quiz, study, progress, settings)
- Quiz flow states (idle, configuring, playing, results)
- Online/offline detection

### Three Custom Hooks (the real logic lives here)

- **useWineData** (`src/hooks/useWineData.js`) - Fetches and caches wine/pronunciation JSON, provides helper methods like `getWinesByStyle`, `getAllWines`, `getOrigins`
- **useProgress** (`src/hooks/useProgress.js`) - localStorage persistence for per-wine stats, streaks, and settings
- **useSpacedRepetition** (`src/hooks/useSpacedRepetition.js`) - SM-2 algorithm implementation for review scheduling

### Quiz Mode Pattern

All 6 quiz modes in `src/quizModes/` follow the same interface:
```jsx
export function QuizMode({ question, onAnswer, showFeedback, darkMode }) {
  // onAnswer(optionId, isCorrect, { wineName, categoryId, explanation })
}
```
QuizEngine generates questions dynamically from selected categories and orchestrates the quiz flow.

### Data Files

- `/public/data/wines.json` - Wine data: styles, wines, origins, colors, descriptions
- `/public/data/pronunciations.json` - Phonetic guides keyed by wine name

### localStorage Keys

- `wineQuizProgress` - Main progress object (per-wine stats, streaks, settings)
- `wineDataCache` - Cached wine data for offline support
- `pronunciationCache` - Cached pronunciation data

## Styling

Single CSS file at `src/styles.css` using CSS custom properties for theming. Dark mode toggles `.dark-mode` class on `<body>`. The `darkMode` prop is passed through the component tree.

## Key Implementation Details

- Text-to-speech uses Web Speech API with preference for Italian/French/Spanish voices
- Offline support: detects connectivity changes, falls back to localStorage cache
- SM-2 spaced repetition: ease factor starts at 2.5, adjusts ±0.1 based on correctness (min 1.3)
- Quiz difficulty controls number of wrong options (3/4/5)
