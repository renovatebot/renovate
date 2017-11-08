jest.mock('gh-got');
jest.mock('gl-got');

global.platform = jest.genMockFromModule('../lib/platform/github');
global.logger = require('./_fixtures/logger');
