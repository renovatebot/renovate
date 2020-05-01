import { tmpdir } from 'os';
import nock from 'nock';
import { join } from 'upath';
import { init } from '../lib/workers/global/cache';

jest.mock('../lib/platform', () => ({
  platform: jest.genMockFromModule('../lib/platform/github'),
  initPlatform: jest.fn(),
  getPlatformList: jest.fn(),
}));
jest.mock('../lib/logger');

const tmpDir = process.env.RENOVATE_TMPDIR || process.env.TMPDIR || tmpdir();
const cacheDir = join(tmpDir, './renovate/cache/renovate');

init(cacheDir);

beforeAll(() => {
  nock.disableNetConnect();
});
