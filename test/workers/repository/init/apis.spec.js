const glGot = require('gl-got');
const { initApis } = require('../../../../lib/workers/repository/init/apis');

jest.mock('../../../../lib/platform/github');

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    let config;
    beforeEach(() => {
      config = require('../../../_fixtures/config');
      config.errors = [];
      config.warnings = [];
      config.token = 'some-token';
    });
    it('runs', async () => {
      await initApis(config);
    });
    it('runs gitlab', async () => {
      config.platform = 'gitlab';
      config.repository = 'some/name';
      glGot.mockReturnValueOnce({ body: {} });
      glGot.mockReturnValueOnce({ body: {} });
      glGot.mockReturnValueOnce({ body: [] });
      glGot.mockReturnValueOnce({ body: [] });
      await initApis(config);
    });
  });
});
