import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCurrentTime } from '../hooks/useCurrentTime'

describe('useCurrentTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes time-dependent views on the next minute boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:34:30.000Z'))
    const { result } = renderHook(() => useCurrentTime())

    expect(result.current.toISOString()).toBe('2026-08-14T12:34:30.000Z')
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current.toISOString()).toBe('2026-08-14T12:35:00.000Z')
  })
})
