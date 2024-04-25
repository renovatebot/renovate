import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import { flattenUpdates } from './flatten';

jest.mock('../../../util/git/semantic');

let config: RenovateConfig;

beforeEach(() => {
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/flatten', () => {
  describe('flattenUpdates()', () => {
    it('flattens', async () => {
      // TODO #22198
      config.lockFileMaintenance!.enabled = true;
      config.packageRules = [
        {
          matchUpdateTypes: ['minor'],
          automerge: true,
        },
        {
          matchFileNames: ['frontend/package.json'],
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
              {
                depName: '@org/a',
                updates: [
                  {
                    newValue: '1.0.0',
                    sourceUrl: 'https://github.com/org/repo',
                  },
                ],
              },
              {
                depName: 'foo',
                updates: [
                  {
                    newValue: '2.0.0',
                    sourceUrl: 'https://github.com/org/repo',
                  },
                ],
              },
              {
                updateTypes: ['pin'],
                updates: [{ newValue: '2.0.0' }],
              },
              {
                depName: 'abc',
                updates: [
                  {
                    newName: 'def',
                    newValue: '2.0.0',
                    updateType: 'replacement',
                  },
                ],
              },
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                depName: 'bar',
                updates: [{ newValue: '3.0.0', sourceUrl: 3 }],
              },
            ],
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
                language: 'docker',
                sourceUrl: 'https://github.com/nodejs/node',
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
                sourceUrl: 'https://calico.com',
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
      expect(res).toHaveLength(14);
      expect(
        res.every(
          (upgrade) =>
            upgrade.isLockFileMaintenance ||
            upgrade.isRemediation ||
            is.number(upgrade.depIndex),
        ),
      ).toBeTrue();
      expect(
        res.filter((update) => update.sourceRepoSlug)[0].sourceRepoSlug,
      ).toBe('org-repo');
      expect(res.filter((update) => update.sourceRepo)[0].sourceRepo).toBe(
        'org/repo',
      );
      expect(
        res.filter((update) => update.sourceRepoOrg)[0].sourceRepoOrg,
      ).toBe('org');
      expect(
        res.filter((update) => update.sourceRepoName)[0].sourceRepoName,
      ).toBe('repo');
      expect(
        res.filter((update) => update.sourceRepoSlug)[1].sourceRepoSlug,
      ).toBe('org-repo');
      expect(res.filter((update) => update.sourceRepo)[1].sourceRepo).toBe(
        'org/repo',
      );
      expect(
        res.filter((update) => update.sourceRepoOrg)[1].sourceRepoOrg,
      ).toBe('org');
      expect(
        res.filter((update) => update.sourceRepoName)[1].sourceRepoName,
      ).toBe('repo');
      expect(
        res.filter((update) => update.sourceRepoSlug)[2].sourceRepoSlug,
      ).toBe('nodejs-node');
      expect(res.filter((update) => update.sourceRepo)[2].sourceRepo).toBe(
        'nodejs/node',
      );
      expect(
        res.filter((update) => update.sourceRepoOrg)[2].sourceRepoOrg,
      ).toBe('nodejs');
      expect(
        res.filter((update) => update.sourceRepoName)[2].sourceRepoName,
      ).toBe('node');
      expect(
        res.filter(
          (r) =>
            r.updateType === 'lockFileMaintenance' && r.isLockFileMaintenance,
        ),
      ).toHaveLength(2);
      expect(res.filter((r) => r.isVulnerabilityAlert)).toHaveLength(1);
    });
  });
});
