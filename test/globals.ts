import { join } from 'upath';
import { tmpdir } from 'os';
import { init } from '../lib/workers/global/cache';

jest.mock('../lib/platform', () => ({
  platform: jest.genMockFromModule('../lib/platform/github'),
  initPlatform: jest.fn(),
}));
jest.mock('../lib/logger');

global.repoCache = {};

const tmpDir = process.env.RENOVATE_TMPDIR || process.env.TMPDIR || tmpdir();
const cacheDir = join(tmpDir, './renovate/cache/renovate');

init(cacheDir);
