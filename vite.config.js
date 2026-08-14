import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    setupFiles: './src/test/setup.js',
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/components/App.jsx',
        'src/components/Home.jsx',
        'src/components/Navigation.jsx',
        'src/components/QuizEngine.jsx',
        'src/components/QuizModeSelector.jsx',
        'src/components/Settings.jsx',
        'src/components/SpeakButton.jsx',
        'src/hooks/useProgress.js',
        'src/quiz/**/*.js',
        'src/quizModes/OddOneOut.jsx',
        'src/quizModes/QuickFire.jsx',
        'src/utils/speak.js',
      ],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 85,
        lines: 85,
      },
    },
  },
})
