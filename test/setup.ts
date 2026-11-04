// Check for missing or pending http mocks
import './http-mock.ts';
import { mockDeep } from 'vitest-mock-extended';
import type { Platform, PlatformScm } from '../lib/modules/platform/index.ts';
import * as _fixtures from './fixtures.ts';

// Set timezone so snapshots are consistent
process.env.TZ = 'UTC';

afterEach(async () => {
  // dynamic import to avoid caching this before per-file mocks are hoisted into place
  const hostRules = await import('../lib/util/host-rules.ts');
  hostRules.clear();
});

declare global {
  // set by the canary `config.js` in the repository root, see .github/workflows/build.yml
  var __RENOVATE_CONFIG_JS_CANARY__: boolean | undefined;
}

afterEach(() => {
  if (globalThis.__RENOVATE_CONFIG_JS_CANARY__) {
    globalThis.__RENOVATE_CONFIG_JS_CANARY__ = undefined;
    throw new Error(
      "A test imported the repository's config.js. Tests must not depend on files in the working directory; use a temporary directory instead.",
    );
  }
});

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
