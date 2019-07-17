const { initApis } = require('../../../../lib/workers/repository/init/apis');

jest.mock('../../../../lib/platform/github');

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    /** @type any */
    let config;
    beforeEach(() => {
      config = require('../../../config/config/_fixtures');
      config.errors = [];
      config.warnings = [];
      config.token = 'some-token';
    });
    it('runs', async () => {
      await initApis(config);
    });
  });
});
