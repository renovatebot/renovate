import nock from 'nock';
import 'jest-extended';

jest.mock('../lib/platform', () => ({
  platform: jest.createMockFromModule('../lib/platform/github'),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));
jest.mock('../lib/logger');

beforeAll(() => {
  nock.disableNetConnect();
});
