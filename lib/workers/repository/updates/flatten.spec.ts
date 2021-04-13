import { RenovateConfig, getConfig, getName } from '../../../../test/util';

import { LANGUAGE_DOCKER } from '../../../constants/languages';
import { flattenUpdates } from './flatten';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe(getName(__filename), () => {
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
      config.remediations = {
        'package-lock.json': [
          {
            datasoource: 'npm',
            depName: 'foo',
            currentVersion: '1.2.0',
            newVersion: '1.3.0',
            prBodyNotes: '',
          },
        ],
      };
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            lockFiles: ['package-lock.json'],
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
      expect(res).toHaveLength(13);
      expect(
        res.filter((r) => r.updateType === 'lockFileMaintenance')
      ).toHaveLength(2);
      expect(res.filter((r) => r.isVulnerabilityAlert)).toHaveLength(1);
    });
  });
});
