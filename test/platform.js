jest.mock('gh-got');
jest.mock('gl-got');

global.platform = require('../lib/platform');

Object.assign(
  global.platform,
  jest.genMockFromModule('../lib/platform/github')
);
