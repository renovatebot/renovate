import { RenovateConfig, getConfig } from '../../../../test/util';

import { LANGUAGE_DOCKER } from '../../../constants/languages';
import { flattenUpdates } from './flatten';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/flatten', () => {
  describe('flattenUpdates()', () => {
    it('flattens', async () => {
      config.lockFileMaintenance.enabled = true;
      config.packageRules = [
        {
          matchUpdateTypes: ['minor'],
          automerge: true,
        },
        {
          matchPaths: ['frontend/package.json'],
          lockFileMaintenance: {
            enabled: false,
          },
        },
      ];
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              { depName: '@org/a', updates: [{ newValue: '1.0.0' }] },
              { depName: 'foo', updates: [{ newValue: '2.0.0' }] },
              {
                updateTypes: ['pin'],
                updates: [{ newValue: '2.0.0' }],
              },
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [{ depName: 'bar', updates: [{ newValue: '3.0.0' }] }],
          },
          {
            packageFile: 'frontend/package.json',
            deps: [{ depName: 'baz', updates: [{ newValue: '3.0.1' }] }],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'amd64/node',
                language: LANGUAGE_DOCKER,
                updates: [{ newValue: '10.0.1' }],
              },
            ],
          },
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'calico/node',
                language: LANGUAGE_DOCKER,
                updates: [{ newValue: '3.2.0', updateType: 'minor' }],
              },
            ],
          },
        ],
        gomod: [
          {
            packageFile: 'go.mod',
            deps: [
              {
                depName: 'github.com/Parallels/docker-machine-parallels',
                updates: [{ newValue: '1.3.0' }],
              },
              {
                depName: 'gopkg.in/yaml.v2',
                updates: [{ newValue: '2.2.8', updateType: 'minor' }],
              },
              {
                depName: 'gopkg.in/warnings.v0',
                updates: [{ newValue: '0.1.3' }],
              },
              {
                depName: 'github.com/blang/semver',
                updates: [],
              },
            ],
          },
        ],
      };
      const res = await flattenUpdates(config, packageFiles);
      expect(res).toHaveLength(12);
      expect(
        res.filter((r) => r.updateType === 'lockFileMaintenance')
      ).toHaveLength(2);
      const deps = res.filter((r) => r.depNameShort);
      expect(deps).toHaveLength(9); // lockFileMaintenance has no depName
      expect(
        deps.map(({ depName, depNameShort }) => ({ depName, depNameShort }))
      ).toMatchSnapshot();
    });
  });
});
