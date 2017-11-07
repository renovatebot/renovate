const { initApis } = require('../../../../lib/workers/repository/init/apis');

const ghGot = require('gh-got');
const glGot = require('gl-got');

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    let config;
    beforeEach(() => {
      config = require('../../../_fixtures/config');
      config.errors = [];
      config.warnings = [];
    });
    it('runs', async () => {
      // initRepo
      ghGot.mockReturnValueOnce({ body: { owner: {} } });
      ghGot.mockReturnValueOnce({ body: { object: {} } });
      ghGot.mockReturnValueOnce({ body: {} });
      await initApis(config, 'some-token');
    });
    it('runs gitlab', async () => {
      config.platform = 'gitlab';
      config.repository = 'some/name';
      glGot.mockReturnValueOnce({ body: {} });
      glGot.mockReturnValueOnce({ body: {} });
      glGot.mockReturnValueOnce({ body: {} });
      await initApis(config, 'some-token');
    });
  });
});
