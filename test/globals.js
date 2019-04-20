const upath = require('upath');
const os = require('os');

jest.mock('gh-got');
jest.mock('gl-got');

const cache = require('../lib/workers/global/cache');

global.platform = jest.genMockFromModule('../lib/platform/github');
global.logger = require('./logger/_fixtures');

global.renovateUsername = 'renovate-testing';
global.repoCache = {};

const tmpDir = process.env.RENOVATE_TMPDIR || process.env.TMPDIR || os.tmpdir();
const cacheDir = upath.join(tmpDir, './renovate/cache/renovate');

cache.init(cacheDir);
