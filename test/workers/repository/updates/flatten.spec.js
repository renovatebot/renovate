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
              { depName: '@org/a', updates: [{ newValue: '1.0.0' }] },
              { updates: [{ newValue: '2.0.0' }] },
            ],
          },
        ],
        docker: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'amd64/node',
                language: 'docker',
                updates: [{ newValue: '10.0.1' }],
              },
            ],
          },
        ],
      };
      const res = await flattenUpdates(config, packageFiles);
      expect(res).toMatchSnapshot();
    });
  });
});
