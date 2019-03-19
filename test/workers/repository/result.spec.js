const { processResult } = require('../../../lib/workers/repository/result');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../config/config/_fixtures');
});

describe('workers/repository/result', () => {
  describe('processResult()', () => {
    it('runs', () => {
      processResult(config, 'done');
    });
  });
});
