import { hostRules } from '../../../test/util';
import type { PackageRuleInputConfig, UpdateType } from '../../config/types';
import { MISSING_API_CREDENTIALS } from '../../constants/error-messages';
import { DockerDatasource } from '../../modules/datasource/docker';
import { OrbDatasource } from '../../modules/datasource/orb';
import type { HostRule } from '../../types';
import type { MergeConfidence } from '../merge-confidence/types';
import { applyPackageRules } from './index';

type TestConfig = PackageRuleInputConfig & {
  x?: number;
  y?: number;
  groupName?: string;
};

describe('util/package-rules/index', () => {
  const config1: TestConfig = {
    foo: 'bar',

    packageRules: [
      {
        matchPackageNames: ['a', 'b', 'xyz/**', '!xyz/foo**'],
        x: 2,
      },
      {
        matchPackageNames: ['/a/', '/b/', '!aa', '!/d/'],
        y: 2,
      },
      {
        matchPackageNames: ['xyz/**', '!xyz/foo'],
        groupName: 'xyz',
      },
    ],
  };

  it('applies', () => {
    const config: PackageRuleInputConfig = {
      packageName: 'a',
      updateType: 'minor',
      isBump: true,
      currentValue: '1.0.0',
      packageRules: [
        {
          matchPackageNames: ['*'],
          matchCurrentVersion: '<= 2.0.0',
        },
        {
          matchPackageNames: ['b'],
          matchCurrentVersion: '<= 2.0.0',
        },
        {
          matchUpdateTypes: ['bump'],
          labels: ['bump'],
        },
        {
          matchPackageNames: ['b', '!a'],
        },
        {
          matchCurrentVersion: '<= 2.0.0',
        },
      ],
    };
    expect(applyPackageRules(config)).toEqual({
      ...config,
      labels: ['bump'],
    });
  });

  it('applies both rules for a', () => {
    const dep = {
      packageName: 'a',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBe(2);
    expect(res.y).toBe(2);
    expect(res.groupName).toBeUndefined();
  });

  it('applies both rules for b', () => {
    const dep = {
      packageName: 'b',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBe(2);
    expect(res.y).toBe(2);
    expect(res.groupName).toBeUndefined();
  });

  it('applies the second rule', () => {
    const dep = {
      packageName: 'abc',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBe(2);
    expect(res.groupName).toBeUndefined();
  });

  it('applies matchPackageNames', () => {
    const dep = {
      packageName: 'xyz/foo',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.groupName).toBeUndefined();
  });

  it('applies the second second rule', () => {
    const dep = {
      packageName: 'bc',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBe(2);
  });

  it('excludes package name', () => {
    const dep = {
      packageName: 'aa',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBeUndefined();
  });

  it('excludes package pattern', () => {
    const dep = {
      packageName: 'bcd',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBeUndefined();
  });

  it('ignores patterns if lock file maintenance', () => {
    const dep = {
      automerge: true,
      updateType: 'lockFileMaintenance' as UpdateType,
      packageRules: [
        {
          matchPackageNames: ['!/^foo/'],
          automerge: false,
        },
      ],
    };
    // This should not match
    const res = applyPackageRules(dep);
    expect(res.automerge).toBeTrue();
  });

  it('do apply rule with matchPackageName', () => {
    const dep = {
      automerge: true,
      updateType: 'lockFileMaintenance' as UpdateType,
      packageRules: [
        {
          matchPackageNames: ['foo'],
          automerge: false,
        },
      ],
    };
    const res = applyPackageRules(dep);
    expect(res.automerge).toBeTrue();
    const res2 = applyPackageRules({ ...dep, packageName: 'foo' });
    expect(res2.automerge).toBeFalse();
  });

  it('sets skipReason=package-rules if enabled=false', () => {
    const dep: any = {
      depName: 'foo',
      packageRules: [
        {
          enabled: false,
        },
      ],
    };
    const res = applyPackageRules(dep, 'datasource-merge');
    expect(res.enabled).toBeFalse();
    expect(res.skipReason).toBe('package-rules');
    expect(res.skipStage).toBe('datasource-merge');
  });

  it('unsets skipReason=package-rules if enabled=true', () => {
    const dep: any = {
      depName: 'foo',
      packageRules: [
        {
          enabled: false,
        },
        {
          enabled: true,
        },
      ],
    };
    const res = applyPackageRules(dep, 'datasource-merge');
    expect(res.enabled).toBeTrue();
    expect(res.skipReason).toBeUndefined();
    expect(res.skipStage).toBeUndefined();
  });

  it('skips skipReason=package-rules if enabled=true', () => {
    const dep: any = {
      enabled: false,
      depName: 'foo',
      packageRules: [
        {
          enabled: false,
        },
      ],
    };
    const res = applyPackageRules(dep);
    expect(res.skipReason).toBeUndefined();
  });

  it('matches anything if missing inclusive rules', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['!foo'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      packageName: 'foo',
    });
    expect(res1.x).toBeUndefined();
    const res2 = applyPackageRules({
      ...config,
      packageName: 'bar',
    });
    expect(res2.x).toBeDefined();
  });

  it('supports inclusive or', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['neutrino', '/^@neutrino\\//'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({ ...config, packageName: 'neutrino' });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      packageName: '@neutrino/something',
    });
    expect(res2.x).toBeDefined();
  });

  it('filters requested depType', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDepTypes: ['dependencies', 'peerDependencies'],
          matchPackageNames: ['a'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('filters from list of requested depTypes', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDepTypes: ['test'],
          matchPackageNames: ['a'],
          x: 1,
        },
      ],
    };
    const dep = {
      depTypes: ['build', 'test'],
      packageName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('returns false if no depTypes', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDepTypes: ['test'],
          matchPackageNames: ['a'],
          x: 1,
        },
      ],
    };
    const input = { ...config, packageName: 'a' };
    delete input.depType;
    delete input.depTypes;
    const res = applyPackageRules(input);
    expect(res).toEqual(input);
  });

  it('filters managers with matching manager', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchManagers: ['npm', 'meteor'],
          matchPackageNames: ['node'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      manager: 'meteor',
      packageName: 'node',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('filters managers with non-matching manager', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchManagers: ['dockerfile', 'npm'],
          matchPackageNames: ['node'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      language: 'python',
      categories: ['python'],
      manager: 'pipenv',
      packageName: 'node',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('filters categories with matching category', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchCategories: ['node'],
          matchPackageNames: ['node'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      categories: ['javascript', 'node'],
      manager: 'meteor',
      packageName: 'node',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('filters categories with non-matching category', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchCategories: ['docker'],
          matchPackageNames: ['node'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      categories: ['python'],
      manager: 'pipenv',
      packageName: 'node',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('filters categories with undefined category', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchCategories: ['docker'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      manager: 'pipenv',
      packageName: 'node',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('filters datasources with matching datasource', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDatasources: [OrbDatasource.id, DockerDatasource.id],
          x: 1,
        },
        {
          matchDatasources: [DockerDatasource.id],
          y: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      datasource: OrbDatasource.id,
      baseBranch: 'master',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
    expect(res.y).toBeUndefined();
  });

  it('filters branches with matching branch', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchBaseBranches: ['master', 'staging'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      datasource: OrbDatasource.id,
      baseBranch: 'master',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('filters datasources with non-matching datasource', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDatasources: [OrbDatasource.id],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      baseBranch: 'staging',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('filters branches with non-matching branch', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchBaseBranches: ['master'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      baseBranch: 'staging',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('filters branches with matching branch regex', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchBaseBranches: ['/^release\\/.*/'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      datasource: OrbDatasource.id,
      baseBranch: 'release/5.8',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('filters branches with non-matching branch regex', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchBaseBranches: ['/^release\\/.*/'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      datasource: OrbDatasource.id,
      baseBranch: 'master',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('filters updateType', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchUpdateTypes: ['minor', 'patch'],
          x: 1,
        },
        {
          matchUpdateTypes: ['minor'],
          y: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
    expect(res.y).toBeUndefined();
  });

  it('matches matchSourceUrls with glob', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar**',
            'https://github.com/renovatebot/**',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/renovatebot/presets',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('non-matches matchSourceUrls with globs', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar**',
            'https://github.com/renovatebot/**',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/vuejs/vue',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('handles matchSourceUrls when missing sourceUrl', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar**',
            'https://github.com/renovatebot/**',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('matches matchSourceUrls', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar',
            'https://github.com/renovatebot/presets',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/renovatebot/presets',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('non-matches matchSourceUrls', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar',
            'https://github.com/facebook/react',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/facebook/react-native',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  describe('matchConfidence', () => {
    const hostRule: HostRule = {
      hostType: 'merge-confidence',
      token: 'some-token',
    };

    beforeEach(() => {
      hostRules.clear();
      hostRules.add(hostRule);
    });

    it('matches matchConfidence', () => {
      const config: TestConfig = {
        packageRules: [
          {
            matchConfidence: ['high'],
            x: 1,
          },
        ],
      };
      const dep = {
        depType: 'dependencies',
        packageName: 'a',
        mergeConfidenceLevel: 'high' as MergeConfidence,
      };
      const res = applyPackageRules({ ...config, ...dep });
      expect(res.x).toBe(1);
    });

    it('non-matches matchConfidence', () => {
      const config: TestConfig = {
        packageRules: [
          {
            matchConfidence: ['high'],
            x: 1,
          },
        ],
      };
      const dep = {
        depType: 'dependencies',
        packageName: 'a',
        mergeConfidenceLevel: 'low' as MergeConfidence,
      };
      const res = applyPackageRules({ ...config, ...dep });
      expect(res.x).toBeUndefined();
    });

    it('does not match matchConfidence when there is no mergeConfidenceLevel', () => {
      const config: TestConfig = {
        packageRules: [
          {
            matchConfidence: ['high'],
            x: 1,
          },
        ],
      };
      const dep = {
        depType: 'dependencies',
        packageName: 'a',
        mergeConfidenceLevel: undefined,
      };
      const res = applyPackageRules({ ...config, ...dep });
      expect(res.x).toBeUndefined();
    });

    it('throws when unauthenticated', () => {
      const config: TestConfig = {
        packageRules: [
          {
            matchUpdateTypes: ['major'],
            matchConfidence: ['high'],
            x: 1,
          },
        ],
      };
      hostRules.clear();

      let error = new Error();
      try {
        applyPackageRules(config);
      } catch (err) {
        error = err;
      }

      expect(error).toStrictEqual(new Error(MISSING_API_CREDENTIALS));
      expect(error.validationError).toBe('Missing credentials');
      expect(error.validationMessage).toBe(
        'The `matchConfidence` matcher in `packageRules` requires authentication. Please refer to the [documentation](https://docs.renovatebot.com/configuration-options/#matchconfidence) and add the required host rule.',
      );
    });
  });

  it('filters naked depType', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDepTypes: ['dependencies', 'peerDependencies'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('filters out unrequested depType', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDepTypes: ['dependencies', 'peerDependencies'],
          matchPackageNames: ['a'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'devDependencies',
      packageName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('checks if matchCurrentVersion selector is valid and satisfies the condition on range overlap', () => {
    const config: TestConfig = {
      versioning: 'semver',
      packageRules: [
        {
          matchPackageNames: ['test'],
          matchCurrentVersion: '<= 2.0.0',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '^1.0.0',
        currentVersion: '1.0.3',
      },
    });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '^1.0.0',
      },
    });
    expect(res2.x).toBeUndefined();
    const res3 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        lockedVersion: '^1.0.0',
      },
    });
    expect(res3.x).toBeUndefined();
  });

  it('checks if matchCurrentVersion selector is valid and satisfies the condition on pinned to range overlap', () => {
    const config: TestConfig = {
      versioning: 'semver',
      packageRules: [
        {
          matchPackageNames: ['test'],
          matchCurrentVersion: '>= 2.0.0',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '2.4.6',
        currentVersion: '2.4.6',
      },
    });
    expect(res1.x).toBeDefined();
  });

  it('checks if matchCurrentVersion selector is a version and matches if currentValue is a range', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['test'],
          matchCurrentVersion: '2.1.0',
          x: 1,
        },
      ],
      versioning: 'npm',
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '^2.0.0',
      },
    });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '~2.0.0',
      },
    });
    expect(res2.x).toBeUndefined();
  });

  it('checks if matchCurrentVersion selector works with static values', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['test'],
          matchCurrentVersion: '4.6.0',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '4.6.0',
        currentVersion: '4.6.0',
      },
    });
    expect(res1.x).toBeDefined();
  });

  it('checks if matchCurrentVersion selector works with regular expressions', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['test'],
          matchCurrentVersion: '/^4/',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '4.6.0',
        currentVersion: '4.6.0',
      },
    });
    const res2 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '5.6.0',
        currentVersion: '5.6.0',
      },
    });
    expect(res1.x).toBeDefined();
    expect(res2.x).toBeUndefined();
  });

  it('checks if matchCurrentVersion selector works with negated regular expressions', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['test'],
          matchCurrentVersion: '!/^4/',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '4.6.0',
        currentVersion: '4.6.0',
      },
    });
    const res2 = applyPackageRules({
      ...config,
      ...{
        packageName: 'test',
        currentValue: '5.6.0',
        currentVersion: '5.6.0',
      },
    });
    expect(res1.x).toBeUndefined();
    expect(res2.x).toBeDefined();
  });

  it('matches packageFiles', () => {
    const config: TestConfig = {
      packageFile: 'examples/foo/package.json',
      packageRules: [
        {
          matchFileNames: ['package.json'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      packageName: 'test',
    });
    expect(res1.x).toBeUndefined();
    config.packageFile = 'package.json';
    const res2 = applyPackageRules({
      ...config,
      packageName: 'test',
    });
    expect(res2.x).toBeDefined();
  });

  it('matches lock files', () => {
    const config: TestConfig = {
      packageFile: 'examples/foo/package.json',
      lockFiles: ['yarn.lock'],
      packageRules: [
        {
          matchFileNames: ['yarn.lock'],
          x: 1,
        },
      ],
    };
    const res = applyPackageRules(config);
    expect(res.x).toBeDefined();
  });

  it('matches paths', () => {
    const config: TestConfig = {
      packageFile: 'examples/foo/package.json',
      packageRules: [
        {
          matchFileNames: ['examples/**', 'lib/'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      packageName: 'test',
    });
    expect(res1.x).toBeDefined();
    config.packageFile = 'package.json';
    const res2 = applyPackageRules({
      ...config,
      packageName: 'test',
    });
    expect(res2.x).toBeUndefined();
    config.packageFile = 'lib/a/package.json';
    const res3 = applyPackageRules({
      ...config,
      packageName: 'test',
    });
    expect(res3.x).toBeUndefined();
  });

  it('empty rules', () => {
    expect(
      applyPackageRules({ ...config1, packageRules: null as never }),
    ).toEqual({
      foo: 'bar',
      packageRules: null,
    });
  });

  it('creates groupSlug if necessary', () => {
    const config: TestConfig = {
      packageName: 'foo',
      packageRules: [
        {
          matchPackageNames: ['*'],
          groupName: 'A',
          groupSlug: 'a',
        },
        {
          matchPackageNames: ['*'],
          groupName: 'B',
        },
      ],
    };
    const res = applyPackageRules(config);
    expect(res.groupSlug).toBe('b');
  });

  it('matches matchSourceUrls with patterns (case-insensitive)', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar**',
            'https://github.com/Renovatebot/**',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/renovatebot/Presets',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('matches matchSourceUrls(case-insensitive)', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar',
            'https://github.com/Renovatebot/renovate',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      packageName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/renovatebot/Renovate',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('needs language to match', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['abc'],
          matchCategories: ['js'],
          x: 1,
        },
      ],
    };
    const dep = {
      packageName: 'abc',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('needs baseBranch to match', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['abc'],
          matchBaseBranches: ['dev'],
          x: 1,
        },
      ],
    };
    const dep = {
      packageName: 'abc',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('needs manager to match', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['abc'],
          matchManagers: ['npm'],
          x: 1,
        },
      ],
    };
    const dep = {
      packageName: 'abc',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('matches matchDepNames(depName)', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchDepNames: ['test1'],
          x: 1,
        },
      ],
    };

    const res1 = applyPackageRules({
      ...config,
      depName: 'test1',
    });
    const res2 = applyPackageRules({
      ...config,
      depName: 'test2',
    });
    applyPackageRules(config); // coverage

    expect(res1.x).toBe(1);
    expect(res2.x).toBeUndefined();
  });

  it('matches if there are no matchers', () => {
    const config: TestConfig = {
      packageRules: [
        {
          x: 1,
        },
      ],
    };

    const res = applyPackageRules({
      ...config,
      depName: 'test2',
    });

    expect(res.x).toBe(1);
  });
});
