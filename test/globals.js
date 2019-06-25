const upath = require('upath');
const os = require('os');

const cache = require('../lib/workers/global/cache');

global.platform = jest.genMockFromModule('../lib/platform/github');
jest.mock('../lib/logger');

// TODO: to bwe removed! Used to temporary fix logger undefined test failures
global.logger = require('../lib/logger');

global.repoCache = {};

const tmpDir = process.env.RENOVATE_TMPDIR || process.env.TMPDIR || os.tmpdir();
const cacheDir = upath.join(tmpDir, './renovate/cache/renovate');

cache.init(cacheDir);
