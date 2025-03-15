// Check for missing or pending http mocks
import './http-mock';
import { mockDeep } from 'vitest-mock-extended';
import type { Platform, PlatformScm } from '../lib/modules/platform';
import * as _fixtures from './fixtures';

// Set timezone so snapshots are consistent
process.env.TZ = 'UTC';

vi.mock('../lib/modules/platform', () => ({
  platform: mockDeep<Platform>(),
  initPlatform: vi.fn(),
  getPlatformList: vi.fn(),
}));

vi.mock('../lib/modules/platform/scm', () => ({
  scm: mockDeep<PlatformScm>(),
}));

vi.mock('../lib/logger', () => {
  return mockDeep({
    withMeta: <T>(_: Record<string, unknown>, cb: () => T): T => cb(),
  });
});

vi.mock('../lib/util/git', () => mockDeep());

vi.mock('../lib/util/exec/common', () => ({ rawExec: vi.fn() }));

Object.defineProperty(global, 'fixtures', { value: _fixtures });
declare global {
  const fixtures: typeof _fixtures;
}
