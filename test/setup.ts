// Check for missing or pending http mocks
import './http-mock';
import 'expect-more-jest';

jest.mock('../lib/platform', () => ({
  platform: jest.createMockFromModule('../lib/platform/github'),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));
jest.mock('../lib/logger');
