import type { PackageRuleInputConfig, UpdateType } from '../../config/types';
import { ProgrammingLanguage } from '../../constants';

import { DockerDatasource } from '../../modules/datasource/docker';
import { OrbDatasource } from '../../modules/datasource/orb';
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
        matchPackageNames: ['a', 'b'],
        matchPackagePrefixes: ['xyz/'],
        excludePackagePrefixes: ['xyz/foo'],
        x: 2,
      },
      {
        matchPackagePatterns: ['a', 'b'],
        excludePackageNames: ['aa'],
        excludePackagePatterns: ['d'],
        y: 2,
      },
      {
        matchPackagePrefixes: ['xyz/'],
        excludePackageNames: ['xyz/foo'],
        groupName: 'xyz',
      },
    ],
  };

  it('applies', () => {
    const config: PackageRuleInputConfig = {
      depName: 'a',
      isBump: true,
      currentValue: '1.0.0',
      packageRules: [
        {
          matchPackagePatterns: ['*'],
          matchCurrentVersion: '<= 2.0.0',
        },
        {
          matchPackageNames: ['b'],
          matchCurrentVersion: '<= 2.0.0',
        },
        {
          excludePackagePatterns: ['*'],
        },
        {
          matchUpdateTypes: ['bump'],
        },
        {
          excludePackageNames: ['a'],
          matchPackageNames: ['b'],
        },
        {
          matchCurrentVersion: '<= 2.0.0',
        },
      ],
    };
    expect(applyPackageRules(config)).toEqual({
      ...config,
      matchUpdateTypes: ['bump'],
    });
  });

  it('applies both rules for a', () => {
    const dep = {
      depName: 'a',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBe(2);
    expect(res.y).toBe(2);
    expect(res.groupName).toBeUndefined();
  });

  it('applies both rules for b', () => {
    const dep = {
      depName: 'b',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBe(2);
    expect(res.y).toBe(2);
    expect(res.groupName).toBeUndefined();
  });

  it('applies the second rule', () => {
    const dep = {
      depName: 'abc',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBe(2);
    expect(res.groupName).toBeUndefined();
  });

  it('applies matchPackagePrefixes', () => {
    const dep = {
      depName: 'xyz/abc',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBe(2);
    expect(res.y).toBe(2);
    expect(res.groupName).toBe('xyz');
  });

  it('applies excludePackageNames', () => {
    const dep = {
      depName: 'xyz/foo',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.groupName).toBeUndefined();
  });

  it('applies excludePackagePrefixes', () => {
    const dep = {
      depName: 'xyz/foo-a',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.groupName).toBe('xyz');
  });

  it('applies the second second rule', () => {
    const dep = {
      depName: 'bc',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBe(2);
  });

  it('excludes package name', () => {
    const dep = {
      depName: 'aa',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBeUndefined();
  });

  it('excludes package pattern', () => {
    const dep = {
      depName: 'bcd',
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
          excludePackagePatterns: ['^foo'],
          automerge: false,
        },
      ],
    };
    const res = applyPackageRules(dep);
    expect(res.automerge).toBeFalse();
    const res2 = applyPackageRules({ ...dep, depName: 'foo' });
    expect(res2.automerge).toBeTrue();
  });

  it('do not apply rule with empty matchPackagePattern', () => {
    const dep = {
      automerge: true,
      updateType: 'lockFileMaintenance' as UpdateType,
      packageRules: [
        {
          matchPackagePatterns: [],
          excludePackagePatterns: ['^foo'],
          automerge: false,
        },
      ],
    };
    const res = applyPackageRules(dep);
    expect(res.automerge).toBeTrue();
    const res2 = applyPackageRules({ ...dep, depName: 'foo' });
    expect(res2.automerge).toBeTrue();
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
    const res2 = applyPackageRules({ ...dep, depName: 'foo' });
    expect(res2.automerge).toBeFalse();
  });

  it('matches anything if missing inclusive rules', () => {
    const config: TestConfig = {
      packageRules: [
        {
          excludePackageNames: ['foo'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      depName: 'foo',
    });
    expect(res1.x).toBeUndefined();
    const res2 = applyPackageRules({
      ...config,
      depName: 'bar',
    });
    expect(res2.x).toBeDefined();
  });

  it('supports inclusive or', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchPackageNames: ['neutrino'],
          matchPackagePatterns: ['^@neutrino\\/'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({ ...config, depName: 'neutrino' });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      depName: '@neutrino/something',
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
      depName: 'a',
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
      depName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
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
      language: ProgrammingLanguage.JavaScript,
      manager: 'meteor',
      depName: 'node',
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
      language: ProgrammingLanguage.Python,
      manager: 'pipenv',
      depName: 'node',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('filters languages with matching language', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchLanguages: [
            ProgrammingLanguage.JavaScript,
            ProgrammingLanguage.NodeJS,
          ],
          matchPackageNames: ['node'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      language: ProgrammingLanguage.JavaScript,
      manager: 'meteor',
      depName: 'node',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('filters languages with non-matching language', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchLanguages: [ProgrammingLanguage.Docker],
          matchPackageNames: ['node'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      language: ProgrammingLanguage.Python,
      manager: 'pipenv',
      depName: 'node',
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
      depName: 'a',
      updateType: 'patch' as UpdateType,
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
    expect(res.y).toBeUndefined();
  });

  it('matches matchSourceUrlPrefixes', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrlPrefixes: [
            'https://github.com/foo/bar',
            'https://github.com/renovatebot/',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      depName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/renovatebot/presets',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });

  it('non-matches matchSourceUrlPrefixes', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrlPrefixes: [
            'https://github.com/foo/bar',
            'https://github.com/renovatebot/',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      depName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/vuejs/vue',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('handles matchSourceUrlPrefixes when missing sourceUrl', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrlPrefixes: [
            'https://github.com/foo/bar',
            'https://github.com/renovatebot/',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      depName: 'a',
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
      depName: 'a',
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
      depName: 'a',
      updateType: 'patch' as UpdateType,
      sourceUrl: 'https://github.com/facebook/react-native',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('handles matchSourceUrls when missing sourceUrl', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrls: [
            'https://github.com/foo/bar',
            'https://github.com/renovatebot/',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      depName: 'a',
      updateType: 'patch' as UpdateType,
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
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
      depName: 'a',
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
      depName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });

  it('checks if matchCurrentVersion selector is valid and satisfies the condition on range overlap', () => {
    const config: TestConfig = {
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
        depName: 'test',
        currentValue: '^1.0.0',
        currentVersion: '1.0.3',
      },
    });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
        currentValue: '^1.0.0',
      },
    });
    expect(res2.x).toBeUndefined();
    const res3 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
        lockedVersion: '^1.0.0',
      },
    });
    expect(res3.x).toBeUndefined();
  });

  it('checks if matchCurrentVersion selector is valid and satisfies the condition on pinned to range overlap', () => {
    const config: TestConfig = {
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
        depName: 'test',
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
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
        currentValue: '^2.0.0',
      },
    });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
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
        depName: 'test',
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
        depName: 'test',
        currentValue: '4.6.0',
        currentVersion: '4.6.0',
      },
    });
    const res2 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
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
        depName: 'test',
        currentValue: '4.6.0',
        currentVersion: '4.6.0',
      },
    });
    const res2 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
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
          matchFiles: ['package.json'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res1.x).toBeUndefined();
    config.packageFile = 'package.json';
    const res2 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res2.x).toBeDefined();
  });

  it('matches lock files', () => {
    const config: TestConfig = {
      packageFile: 'examples/foo/package.json',
      lockFiles: ['yarn.lock'],
      packageRules: [
        {
          matchFiles: ['yarn.lock'],
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
          matchPaths: ['examples/**', 'lib/'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res1.x).toBeDefined();
    config.packageFile = 'package.json';
    const res2 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res2.x).toBeUndefined();
    config.packageFile = 'lib/a/package.json';
    const res3 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res3.x).toBeDefined();
  });

  it('empty rules', () => {
    expect(
      applyPackageRules({ ...config1, packageRules: null as never })
    ).toEqual({
      foo: 'bar',
      packageRules: null,
    });
  });

  it('creates groupSlug if necessary', () => {
    const config: TestConfig = {
      depName: 'foo',
      packageRules: [
        {
          matchPackagePatterns: ['*'],
          groupName: 'A',
          groupSlug: 'a',
        },
        {
          matchPackagePatterns: ['*'],
          groupName: 'B',
        },
      ],
    };
    const res = applyPackageRules(config);
    expect(res.groupSlug).toBe('b');
  });

  it('matches matchSourceUrlPrefixes(case-insensitive)', () => {
    const config: TestConfig = {
      packageRules: [
        {
          matchSourceUrlPrefixes: [
            'https://github.com/foo/bar',
            'https://github.com/Renovatebot/',
          ],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      depName: 'a',
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
      depName: 'a',
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
          matchLanguages: ['js'],
          x: 1,
        },
      ],
    };
    const dep = {
      depName: 'abc',
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
      depName: 'abc',
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
      depName: 'abc',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });
});
