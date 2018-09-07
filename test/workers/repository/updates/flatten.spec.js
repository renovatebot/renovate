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
      config.packageRules = [
        {
          updateTypes: ['minor'],
          automerge: true,
        },
      ];
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              { depName: '@org/a', updates: [{ newValue: '1.0.0' }] },
              { depName: 'foo', updates: [{ newValue: '2.0.0' }] },
            ],
          },
        ],
        dockerfile: [
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
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'calico/node',
                language: 'docker',
                updates: [{ newValue: '3.2.0' }],
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
