import is from '@sindresorhus/is';
import { getConfig } from '../../../config/defaults';
import { flattenUpdates, sanitizeDepName } from './flatten';
import type { RenovateConfig } from '~test/util';

vi.mock('../../../util/git/semantic');

let config: RenovateConfig;

beforeEach(() => {
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/flatten', () => {
  describe('sanitizeDepName()', () => {
    it('sanitizes urls', () => {
      expect(sanitizeDepName('https://some.host.name/a/path/to.git')).toBe(
        'https-some.host.name-a-path-to.git',
      );
    });
  });

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
        {
          matchPackageNames: ['@monorepo/package'],
          sourceUrl: 'https://github.com/some/monorepo',
          sourceDirectory: "subfolder/{{ lookup (split packageName '/') 1 }}",
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
                depName: '@monorepo/package',
                updates: [
                  {
                    newValue: '2.0.0',
                    sourceUrl: 'https://github.com/some/monorepo',
                    sourceDirectory:
                      "subfolder/{{ lookup (split depName '/') 1 }}",
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
      expect(res).toHaveLength(15);
      expect(
        res.every(
          (upgrade) =>
            upgrade.isLockFileMaintenance ??
            upgrade.isRemediation ??
            is.number(upgrade.depIndex),
        ),
      ).toBeTrue();
      expect(res.find((update) => update.sourceRepoSlug)!.sourceRepoSlug).toBe(
        'org-repo',
      );
      expect(res.find((update) => update.sourceRepo)!.sourceRepo).toBe(
        'org/repo',
      );
      expect(res.find((update) => update.sourceRepoOrg)!.sourceRepoOrg).toBe(
        'org',
      );
      expect(res.find((update) => update.sourceRepoName)!.sourceRepoName).toBe(
        'repo',
      );
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
        res.find((update) => update.depName === '@monorepo/package'),
      ).toEqual(
        expect.objectContaining({
          depName: '@monorepo/package',
          sourceRepoOrg: 'some',
          sourceRepoName: 'monorepo',
          sourceRepo: 'some/monorepo',
          sourceRepoSlug: 'some-monorepo',
          sourceUrl: 'https://github.com/some/monorepo',
          sourceDirectory: 'subfolder/package',
        }),
      );
      expect(
        res.filter((update) => update.sourceRepoSlug)[3].sourceRepoSlug,
      ).toBe('nodejs-node');
      expect(res.filter((update) => update.sourceRepo)[3].sourceRepo).toBe(
        'nodejs/node',
      );
      expect(
        res.filter((update) => update.sourceRepoOrg)[3].sourceRepoOrg,
      ).toBe('nodejs');
      expect(
        res.filter((update) => update.sourceRepoName)[3].sourceRepoName,
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
