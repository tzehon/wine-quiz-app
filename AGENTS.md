# Wine Quiz App guidance

This file applies to the whole repository.

## Project overview

- React 19 + Vite static web app; there is no backend.
- `src/components/App.jsx` owns view routing, quiz flow, connectivity state, and the main hooks.
- Quiz implementations live in `src/quizModes/` and are orchestrated by `src/components/QuizEngine.jsx`.
- Wine content and pronunciation guides live in `public/data/`.
- User progress, settings, and offline data are persisted in `localStorage`.
- Styling is centralized in `src/styles.css` with CSS custom properties and a body-level dark-mode class.

## Commands

```bash
npm install
npm run dev
npm run lint
npm test
npm run test:watch
npm run test:coverage
npm run build
npm run preview
```

## Working constraints

- Preserve offline fallback and compatibility with existing saved progress and imported progress JSON.
- Keep quiz modes compatible with the shared `question`, `onAnswer`, `showFeedback`, and `darkMode` contract.
- When adding or renaming a wine, update both `public/data/wines.json` and `public/data/pronunciations.json`, then update the category list in `README.md` if needed.
- Keep the mobile-first layout, keyboard access, and light/dark themes working together.
- Avoid unrelated cleanup in focused changes.

## Verification

- Run `npm run lint`, `npm test`, and `npm run build` after code changes.
- Run `npm run test:coverage` when changing tested behavior or expanding the coverage scope.
- For UI changes, manually exercise the affected flow at desktop and mobile widths, including its empty, error, and feedback states where relevant.
- For progress or quiz changes, verify a complete quiz, results, progress persistence after reload, and export/import compatibility.
- Report any pre-existing validation failures separately from regressions introduced by the change.

## Release impact

After each change, state whether it needs a web redeployment. User-visible code or data changes normally do; documentation-only, test-only, and agent-guidance changes do not. Do not change version metadata unless the user asks or the release process explicitly requires it; ask when uncertain.
