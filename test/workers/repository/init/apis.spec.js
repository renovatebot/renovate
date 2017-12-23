const { initApis } = require('../../../../lib/workers/repository/init/apis');

const glGot = require('gl-got');

jest.mock('../../../../lib/platform/github');

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    let config;
    beforeEach(() => {
      config = require('../../../_fixtures/config');
      config.errors = [];
      config.warnings = [];
    });
    it('runs', async () => {
      await initApis(config, 'some-token');
    });
    it('runs gitlab', async () => {
      config.platform = 'gitlab';
      config.repository = 'some/name';
      glGot.mockReturnValueOnce({ body: {} });
      glGot.mockReturnValueOnce({ body: {} });
      glGot.mockReturnValueOnce({ body: [] });
      glGot.mockReturnValueOnce({ body: [] });
      await initApis(config, 'some-token');
    });
    it('runs vsts', async () => {
      config.platform = 'vsts';
      config.repository = 'some/name';
      // config.endpoint = 'https://fabrikam.visualstudio.com/DefaultCollection';
      try {
        await initApis(config, 'some-token');
      } catch (error) {
        expect(error.message).toBe(
          'You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)'
        );
      }
    });
  });
});
