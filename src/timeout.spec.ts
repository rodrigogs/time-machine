import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Timeout from './timeout'

describe('Timeout', () => {
  let timeout: Timeout
  const mockDate = new Date('2023-01-01T00:00:00.000Z')
  
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should create a new Timeout instance with specified duration', () => {
      const duration = 5000
      timeout = new Timeout(duration)
      
      expect(timeout).toBeInstanceOf(Timeout)
      expect(timeout['duration']).toBe(duration)
      expect(timeout['startTime']).toEqual(mockDate)
    })

    it('should initialize start time to current time', () => {
      timeout = new Timeout(1000)
      
      expect(timeout['startTime']).toEqual(mockDate)
    })

    it('should handle zero duration', () => {
      timeout = new Timeout(0)
      
      expect(timeout['duration']).toBe(0)
      expect(timeout.isTimedOut()).toBe(false) // 0 > 0 is false
    })

    it('should handle negative duration', () => {
      timeout = new Timeout(-1000)
      
      expect(timeout['duration']).toBe(-1000)
      expect(timeout.isTimedOut()).toBe(true)
    })
  })

  describe('isTimedOut', () => {
    it('should return false when duration has not elapsed', () => {
      timeout = new Timeout(5000)
      
      // Advance time by 2 seconds (less than 5 second timeout)
      vi.advanceTimersByTime(2000)
      
      expect(timeout.isTimedOut()).toBe(false)
    })

    it('should return true when duration has elapsed', () => {
      timeout = new Timeout(1000)
      
      // Advance time by 2 seconds (more than 1 second timeout)
      vi.advanceTimersByTime(2000)
      
      expect(timeout.isTimedOut()).toBe(true)
    })

    it('should return false when duration exactly equals elapsed time', () => {
      timeout = new Timeout(3000)
      
      // Advance time by exactly 3 seconds
      vi.advanceTimersByTime(3000)
      
      expect(timeout.isTimedOut()).toBe(false) // 3000 > 3000 is false
    })

    it('should return false immediately after creation with positive duration', () => {
      timeout = new Timeout(1000)
      
      expect(timeout.isTimedOut()).toBe(false)
    })

    it('should return false immediately for zero duration', () => {
      timeout = new Timeout(0)
      
      expect(timeout.isTimedOut()).toBe(false) // 0 > 0 is false
    })

    it('should return true immediately for negative duration', () => {
      timeout = new Timeout(-500)
      
      expect(timeout.isTimedOut()).toBe(true)
    })

    it('should correctly calculate time differences over multiple checks', () => {
      timeout = new Timeout(2000)
      
      expect(timeout.isTimedOut()).toBe(false)
      
      vi.advanceTimersByTime(1000)
      expect(timeout.isTimedOut()).toBe(false)
      
      vi.advanceTimersByTime(1000)
      expect(timeout.isTimedOut()).toBe(false) // 2000 > 2000 is false
      
      vi.advanceTimersByTime(1000)
      expect(timeout.isTimedOut()).toBe(true) // 3000 > 2000 is true
    })
  })

  describe('logDuration', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should log the elapsed duration with default message', () => {
      timeout = new Timeout(1000)
      
      vi.advanceTimersByTime(500)
      timeout.logDuration()
      
      expect(console.log).toHaveBeenCalledWith(': 500')
    })

    it('should log the elapsed duration with custom message', () => {
      timeout = new Timeout(2000)
      
      vi.advanceTimersByTime(1500)
      timeout.logDuration('Test duration')
      
      expect(console.log).toHaveBeenCalledWith('Test duration: 1500')
    })

    it('should log zero duration immediately after creation', () => {
      timeout = new Timeout(1000)
      
      timeout.logDuration('Initial')
      
      expect(console.log).toHaveBeenCalledWith('Initial: 0')
    })

    it('should log accurate duration at different time points', () => {
      timeout = new Timeout(5000)
      
      timeout.logDuration('Start')
      expect(console.log).toHaveBeenCalledWith('Start: 0')
      
      vi.advanceTimersByTime(1000)
      timeout.logDuration('1 second')
      expect(console.log).toHaveBeenCalledWith('1 second: 1000')
      
      vi.advanceTimersByTime(2000)
      timeout.logDuration('3 seconds')
      expect(console.log).toHaveBeenCalledWith('3 seconds: 3000')
    })

    it('should handle empty string message', () => {
      timeout = new Timeout(1000)
      
      vi.advanceTimersByTime(250)
      timeout.logDuration('')
      
      expect(console.log).toHaveBeenCalledWith(': 250')
    })

    it('should handle special characters in message', () => {
      timeout = new Timeout(1000)
      
      vi.advanceTimersByTime(100)
      timeout.logDuration('Test: [special] {chars} & symbols!')
      
      expect(console.log).toHaveBeenCalledWith('Test: [special] {chars} & symbols!: 100')
    })
  })

  describe('getDuration (private method behavior)', () => {
    it('should calculate correct duration through isTimedOut calls', () => {
      timeout = new Timeout(1000)
      
      // Test through the public interface since getDuration is private
      expect(timeout.isTimedOut()).toBe(false) // Duration: 0, Timeout: 1000
      
      vi.advanceTimersByTime(500)
      expect(timeout.isTimedOut()).toBe(false) // Duration: 500, Timeout: 1000
      
      vi.advanceTimersByTime(500)
      expect(timeout.isTimedOut()).toBe(false) // Duration: 1000, Timeout: 1000 (1000 > 1000 is false)
      
      vi.advanceTimersByTime(500)
      expect(timeout.isTimedOut()).toBe(true) // Duration: 1500, Timeout: 1000 (1500 > 1000 is true)
    })
  })

  describe('edge cases', () => {
    it('should handle very large durations', () => {
      const largeDuration = Number.MAX_SAFE_INTEGER
      timeout = new Timeout(largeDuration)
      
      expect(timeout['duration']).toBe(largeDuration)
      expect(timeout.isTimedOut()).toBe(false)
      
      vi.advanceTimersByTime(1000000)
      expect(timeout.isTimedOut()).toBe(false)
    })

    it('should handle floating point durations', () => {
      timeout = new Timeout(1500.5)
      
      expect(timeout['duration']).toBe(1500.5)
      
      vi.advanceTimersByTime(1500)
      expect(timeout.isTimedOut()).toBe(false) // 1500 > 1500.5 is false
      
      vi.advanceTimersByTime(1)
      expect(timeout.isTimedOut()).toBe(true) // 1501 > 1500.5 is true
    })

    it('should maintain accuracy across multiple time advances', () => {
      timeout = new Timeout(1000)
      
      // Advance time in small increments
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(100)
        if (i < 10) { // All 10 iterations (0-9): 100ms * (i+1) = 100ms to 1000ms, all <= 1000ms
          expect(timeout.isTimedOut()).toBe(false) // (i+1)*100 > 1000 is false for i=0-9
        }
      }
      
      // Now advance one more millisecond to exceed the timeout
      vi.advanceTimersByTime(1)
      expect(timeout.isTimedOut()).toBe(true) // 1001 > 1000 is true
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should work correctly for file operation timeout simulation', () => {
      // Simulate a 30-second file operation timeout
      timeout = new Timeout(30000)
      
      expect(timeout.isTimedOut()).toBe(false)
      
      // Simulate file operation taking 25 seconds
      vi.advanceTimersByTime(25000)
      expect(timeout.isTimedOut()).toBe(false)
      
      // Operation completes before timeout
      timeout.logDuration('File operation completed')
      expect(console.log).toHaveBeenCalledWith('File operation completed: 25000')
    })

    it('should handle rapid successive checks', () => {
      timeout = new Timeout(1000)
      
      // Check multiple times at the same time point
      for (let i = 0; i < 5; i++) {
        expect(timeout.isTimedOut()).toBe(false)
      }
      
      vi.advanceTimersByTime(1001) // Need to exceed 1000ms for timeout
      
      // Check multiple times after timeout
      for (let i = 0; i < 5; i++) {
        expect(timeout.isTimedOut()).toBe(true)
      }
    })

    it('should work correctly with watch-like functionality', () => {
      timeout = new Timeout(5000)
      
      const checkpoints = [1000, 2000, 3000, 4000, 5000, 6000]
      const results: boolean[] = []
      
      checkpoints.forEach((checkpoint, index) => {
        vi.advanceTimersByTime(1000) // Always advance by 1000ms
        results.push(timeout.isTimedOut())
        timeout.logDuration(`Checkpoint ${checkpoint}ms`)
      })
      
      // After 6 iterations of 1000ms each: 1000, 2000, 3000, 4000, 5000, 6000
      // Only 6000 > 5000, so only the last one should be true
      expect(results).toEqual([false, false, false, false, false, true])
      expect(console.log).toHaveBeenCalledTimes(6)
    })
  })
})
