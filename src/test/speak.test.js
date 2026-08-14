import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSpeechSupported, speakWineName } from '../utils/speak'

class TestUtterance {
  constructor(text) {
    this.text = text
    this.voice = null
    this.rate = 1
    this.pitch = 1
  }
}

describe('speech utility', () => {
  beforeEach(() => {
    vi.stubGlobal('SpeechSynthesisUtterance', TestUtterance)
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        getVoices: vi.fn(() => [
          { name: 'French', lang: 'fr-FR' },
          { name: 'Italian', lang: 'it-IT' },
        ]),
        speak: vi.fn(),
      },
    })
  })

  afterEach(() => {
    delete window.speechSynthesis
    vi.unstubAllGlobals()
  })

  it('uses the requested language first and configures a clear utterance', () => {
    speakWineName('Chablis', 'fr-FR')

    expect(window.speechSynthesis.cancel).toHaveBeenCalledOnce()
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce()
    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    expect(utterance).toEqual(expect.objectContaining({
      text: 'Chablis',
      rate: 0.8,
      pitch: 1,
      voice: expect.objectContaining({ lang: 'fr-FR' }),
    }))
  })

  it('falls back to a preferred available voice and reports support', () => {
    expect(isSpeechSupported()).toBe(true)
    speakWineName('Barolo', 'ja-JP')

    expect(window.speechSynthesis.speak.mock.calls[0][0].voice)
      .toEqual(expect.objectContaining({ lang: 'it-IT' }))
  })

  it('reports unsupported browsers', () => {
    delete window.speechSynthesis
    expect(isSpeechSupported()).toBe(false)
  })
})
