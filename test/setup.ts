// Check for missing or pending http mocks
import './http-mock';
import { mockDeep } from 'jest-mock-extended';
import type { Platform, PlatformScm } from '../lib/modules/platform';

jest.mock('../lib/modules/platform', () => ({
  platform: mockDeep<Platform>(),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));

jest.mock('../lib/modules/platform/scm', () => ({
  scm: mockDeep<PlatformScm>(),
}));

jest.mock('../lib/logger', () => mockDeep());
