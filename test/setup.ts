// Check for missing or pending http mocks
import './http-mock.ts';
import { mockDeep } from 'vitest-mock-extended';
import type { Platform, PlatformScm } from '../lib/modules/platform/index.ts';
import * as _fixtures from './fixtures.ts';

// Set timezone so snapshots are consistent
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
