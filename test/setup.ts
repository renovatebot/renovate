// Check for missing or pending http mocks
import './http-mock';

jest.mock('../lib/modules/platform', () => ({
  platform: jest.createMockFromModule('../lib/modules/platform/github'),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));
jest.mock('../lib/logger');
