// Check for missing or pending http mocks
import './http-mock';
import * as matchers from 'jest-extended';
import { expect } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { Platform, PlatformScm } from '../lib/modules/platform';

globalThis.jest = vi;

expect.extend(matchers);

vi.mock('../lib/modules/platform', () => ({
  platform: mockDeep<Platform>(),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));
vi.mock('../lib/modules/platform/scm', () => ({
  scm: mockDeep<PlatformScm>(),
}));

vi.mock('../lib/logger', () => mockDeep());
