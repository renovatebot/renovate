const {
  flattenUpdates,
} = require('../../../../lib/workers/repository/updates/flatten');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../../_fixtures/config') };
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/flatten', () => {
  describe('flattenUpdates()', () => {
    it('flattens', async () => {
      config.lockFileMaintenance.enabled = true;
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json ',
            deps: [
              { depName: '@org/a', updates: [{ newVersion: '1.0.0' }] },
              { updates: [{ newVersion: '2.0.0' }] },
            ],
          },
        ],
      };
      const res = await flattenUpdates(config, packageFiles);
      expect(res).toMatchSnapshot();
    });
  });
});
