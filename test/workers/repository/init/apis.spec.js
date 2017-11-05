let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
  config.errors = [];
  config.warnings = [];
});

const { initApis } = require('../../../../lib/workers/repository/init/apis');

jest.mock('../../../../lib/platform/github');

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    it('runs', async () => {
      await initApis(config, 'some-token');
    });
  });
});
