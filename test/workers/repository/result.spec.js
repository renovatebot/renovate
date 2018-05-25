const { processResult } = require('../../../lib/workers/repository/result');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
});

describe('workers/repository/result', () => {
  describe('processResult()', () => {
    it('runs', () => {
      processResult(config, 'done');
    });
  });
});
