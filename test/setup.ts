// Check for missing or pending http mocks
import './http-mock';
import 'expect-more-jest';
import { expect } from 'vitest';
import * as matchers from 'jest-extended';

globalThis.jest = vi;

expect.extend(matchers);

vi.mock('../lib/modules/platform', async () => ({
  platform: await vi.importMock('../lib/modules/platform/github'),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));
vi.mock('../lib/modules/platform/scm', async () => ({
  scm: new (
    await vi.importMock<typeof import('../lib/modules/platform/default-scm')>(
      '../lib/modules/platform/default-scm'
    )
  ).DefaultGitScm(),
}));

vi.mock('../lib/logger');
