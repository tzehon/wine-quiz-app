import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Settings } from '../components/Settings'
import { DEFAULT_QUIZ_MODE_IDS } from '../quiz/quizModes'

function renderSettings(overrides = {}) {
  const props = {
    settings: {
      enabledModes: [...DEFAULT_QUIZ_MODE_IDS],
      difficulty: 'medium',
      questionsPerSession: 10,
    },
    onUpdateSettings: vi.fn(),
    onResetProgress: vi.fn(),
    onExportProgress: vi.fn(),
    onImportProgress: vi.fn(() => true),
    onToggleDarkMode: vi.fn(),
    darkMode: false,
    ...overrides,
  }

  return { ...render(<Settings {...props} />), props }
}

describe('Settings', () => {
  it('updates appearance, modes, difficulty, and question count', async () => {
    const user = userEvent.setup()
    const { props } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Dark mode' }))
    await user.click(screen.getByRole('checkbox', { name: 'Category Match' }))
    await user.click(screen.getByRole('button', { name: /easy/i }))
    await user.click(screen.getByRole('button', { name: '20' }))

    expect(props.onToggleDarkMode).toHaveBeenCalledOnce()
    expect(props.onUpdateSettings).toHaveBeenNthCalledWith(1, {
      enabledModes: DEFAULT_QUIZ_MODE_IDS.filter(mode => mode !== 'category-match'),
    })
    expect(props.onUpdateSettings).toHaveBeenNthCalledWith(2, { difficulty: 'easy' })
    expect(props.onUpdateSettings).toHaveBeenNthCalledWith(3, { questionsPerSession: 20 })
  })

  it('does not allow the final enabled quiz mode to be disabled', async () => {
    const user = userEvent.setup()
    const { props } = renderSettings({
      settings: {
        enabledModes: ['quick-fire'],
        difficulty: 'medium',
        questionsPerSession: 10,
      },
    })

    await user.click(screen.getByRole('checkbox', { name: 'Quick Fire' }))
    expect(props.onUpdateSettings).not.toHaveBeenCalled()
  })

  it('connects export, import success, and import validation feedback', async () => {
    const user = userEvent.setup()
    const { props, rerender } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Export Progress' }))
    expect(props.onExportProgress).toHaveBeenCalledOnce()

    const input = document.querySelector('input[type="file"]')
    await user.upload(input, new File(['{"stats":{}}'], 'progress.json', { type: 'application/json' }))
    await waitFor(() => {
      expect(props.onImportProgress).toHaveBeenCalledWith('{"stats":{}}')
    })
    expect(await screen.findByText('Progress imported successfully!')).toBeInTheDocument()

    const failingProps = { ...props, onImportProgress: vi.fn(() => false) }
    rerender(<Settings {...failingProps} />)
    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(['[]'], 'invalid.json', { type: 'application/json' }),
    )
    expect(await screen.findByText('Invalid progress file format')).toBeInTheDocument()
  })

  it('requires confirmation before resetting progress', async () => {
    const user = userEvent.setup()
    const { props } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Reset All Progress' }))
    expect(screen.getByText('Are you sure? This cannot be undone.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onResetProgress).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Reset All Progress' }))
    await user.click(screen.getByRole('button', { name: 'Yes, Reset' }))
    expect(props.onResetProgress).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.queryByText('Are you sure? This cannot be undone.')).not.toBeInTheDocument()
    })
  })

  it('disables incompatible settings while keeping recovery actions available', () => {
    renderSettings({ isReadOnly: true })

    expect(screen.getByRole('button', { name: 'Dark mode' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Category Match' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /easy/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: '20' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export Progress' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Import Progress' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Reset All Progress' })).toBeEnabled()
    expect(screen.getByText(/export this newer progress file/i)).toBeInTheDocument()
  })
})
