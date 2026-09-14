// Check for missing or pending http mocks
import './http-mock.ts';
import { mockDeep } from 'vitest-mock-extended';
import type { Platform, PlatformScm } from '../lib/modules/platform/index.ts';
import * as _fixtures from './fixtures.ts';

// Set timezone so snapshots are consistent.
//
// This alone isn't reliable under vitest's `threads` pool (as used by
// Stryker's vitest-runner): by the time this file runs, `Date`'s notion of
// the local timezone may already be fixed to the host's real timezone. `TZ`
// needs to be set in the process's actual environment (see the `TZ=UTC`
// prefix on the `test:mutation*` scripts in package.json) for that pool.
process.env.TZ = 'UTC';

vi.mock('../lib/modules/platform/index.ts', () => ({
  platform: mockDeep<Platform>(),
  initPlatform: vi.fn(),
  getPlatformList: vi.fn(),
}));

vi.mock('../lib/modules/platform/scm.ts', () => ({
  scm: mockDeep<PlatformScm>(),
}));

vi.mock('../lib/logger/index.ts', () => {
  return mockDeep({
    withMeta: <T>(_: Record<string, unknown>, cb: () => T): T => cb(),
  });
});

vi.mock('../lib/util/git/index.ts', () => mockDeep());

vi.mock('../lib/util/exec/common.ts', () => ({ rawExec: vi.fn() }));

Object.defineProperty(global, 'fixtures', { value: _fixtures });
declare global {
  const fixtures: typeof _fixtures;
}

vi.mock('../lib/util/mutex.ts', () => ({
  initMutexes: () => vi.fn(),
  acquireLock: () => vi.fn().mockImplementation(() => () => undefined),
}));

// Several specs call `vi.setSystemTime()`/`vi.useFakeTimers()` without
// restoring real timers afterwards. That's harmless when every spec file
// gets its own worker, but under low-concurrency/single-threaded execution
// (e.g. Stryker's vitest-runner) a faked clock leaks into whichever spec
// runs next in the same worker. `afterAll` (rather than `afterEach`) so specs
// that intentionally keep fake timers running across several `it()`s (e.g.
// via a `describe`-level `beforeAll`) aren't affected.
afterAll(() => {
  vi.useRealTimers();
});
