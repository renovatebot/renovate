const upath = require('upath');
const os = require('os');

const cache = require('../lib/workers/global/cache');

global.platform = jest.genMockFromModule('../lib/platform/github');
jest.mock('../lib/logger');

global.repoCache = {};

const tmpDir = process.env.RENOVATE_TMPDIR || process.env.TMPDIR || os.tmpdir();
const cacheDir = upath.join(tmpDir, './renovate/cache/renovate');

cache.init(cacheDir);
