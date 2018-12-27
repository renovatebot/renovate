jest.mock('gh-got');
jest.mock('gl-got');

const cache = require('../lib/workers/global/cache');

global.platform = jest.genMockFromModule('../lib/platform/github');
global.logger = require('./_fixtures/logger');

global.renovateUsername = 'renovate-testing';
global.repoCache = {};

cache.init();
