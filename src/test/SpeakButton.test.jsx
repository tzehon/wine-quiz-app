import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpeakButton } from '../components/SpeakButton'

class TestUtterance {
  constructor(text) {
    this.text = text
  }
}

describe('SpeakButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('SpeechSynthesisUtterance', TestUtterance)
  })

  afterEach(() => {
    delete window.speechSynthesis
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not render when speech synthesis is unavailable', () => {
    render(<SpeakButton text="Riesling" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('speaks without activating its parent and clears the speaking state', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
        speak: vi.fn(),
      },
    })
    const parentClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <SpeakButton text="Riesling" className="inline" />
      </div>,
    )

    const button = screen.getByRole('button', { name: 'Listen to pronunciation of Riesling' })
    fireEvent.click(button)
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce()
    expect(parentClick).not.toHaveBeenCalled()
    expect(button).toHaveTextContent('🔊')

    act(() => vi.advanceTimersByTime(1500))
    expect(button).toHaveTextContent('🔈')
  })
})
