import { vi } from 'vitest';

// TODO: remove when all tests are migrated to vitest
Object.defineProperty(globalThis, 'jest', {
  value: {
    fn: vi.fn,
    spyOn: vi.spyOn,
    doMock: vi.doMock,
    doUnmock: vi.doUnmock,
    resetModules: vi.resetModules,
    resetAllMocks: vi.resetAllMocks,
    restoreAllMocks: vi.restoreAllMocks,
    useFakeTimers: vi.useFakeTimers,
    useRealTimers: vi.useRealTimers,
    setSystemTime: vi.setSystemTime,
    advanceTimersByTime: vi.advanceTimersByTime,
    advanceTimersByTimeAsync: vi.advanceTimersByTimeAsync,
  },
});

interface GlobalJest {
  /** @deprecated */
  fn: typeof vi.fn;
  /** @deprecated */
  spyOn: typeof vi.spyOn;

  /** @deprecated */
  doMock: typeof vi.doMock;
  /** @deprecated */
  doUnmock: typeof vi.doUnmock;

  /** @deprecated */
  resetModules: typeof vi.resetModules;

  /** @deprecated */
  resetAllMocks: typeof vi.resetAllMocks;
  /** @deprecated */
  restoreAllMocks: typeof vi.restoreAllMocks;

  /** @deprecated */
  useFakeTimers: typeof vi.useFakeTimers;
  /** @deprecated */
  useRealTimers: typeof vi.useRealTimers;
  /** @deprecated */
  setSystemTime: typeof vi.setSystemTime;
  /** @deprecated */
  advanceTimersByTime: typeof vi.advanceTimersByTime;
  /** @deprecated */
  advanceTimersByTimeAsync: typeof vi.advanceTimersByTimeAsync;
}

declare global {
  /**
   * @deprecated
   */
  const jest: GlobalJest;
}
