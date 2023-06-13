import deepmerge from 'deepmerge';
import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency } from '../types';
import * as fragments from './fragments';
import {
  BasePackageDep,
  BazelModulePackageDep,
  OverridePackageDep,
  RuleToBazelModulePackageDep,
  overrideToPackageDependency,
  processModulePkgDeps,
  toPackageDependencies,
} from './rules';

const bazelDepPkgDep: BasePackageDep = {
  datasource: BazelDatasource.id,
  depType: 'bazel_dep',
  depName: 'rules_foo',
  currentValue: '1.2.3',
};
const gitOverrideForGithubPkgDep: OverridePackageDep = {
  datasource: GithubTagsDatasource.id,
  depType: 'git_override',
  depName: 'rules_foo',
  packageName: 'example/rules_foo',
  currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
  bazelDepSkipReason: 'git-dependency',
};
const gitOverrideForUnsupportedPkgDep: OverridePackageDep = {
  depType: 'git_override',
  depName: 'rules_foo',
  currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
  bazelDepSkipReason: 'git-dependency',
  skipReason: 'unsupported-datasource',
};
const archiveOverridePkgDep: OverridePackageDep = {
  depType: 'archive_override',
  depName: 'rules_foo',
  skipReason: 'unsupported-datasource',
  bazelDepSkipReason: 'file-dependency',
};
const localPathOverridePkgDep: OverridePackageDep = {
  depType: 'local_path_override',
  depName: 'rules_foo',
  skipReason: 'unsupported-datasource',
  bazelDepSkipReason: 'local-dependency',
};

describe('modules/manager/bazel-module/rules', () => {
  describe('RuleToBazelModulePackageDep', () => {
    const bazelDepWithoutDevDep = fragments.record({
      rule: fragments.string('bazel_dep'),
      name: fragments.string('rules_foo'),
      version: fragments.string('1.2.3'),
    });
    const gitOverrideWithGihubHost = fragments.record({
      rule: fragments.string('git_override'),
      module_name: fragments.string('rules_foo'),
      remote: fragments.string('https://github.com/example/rules_foo.git'),
      commit: fragments.string('850cb49c8649e463b80ef7984e7c744279746170'),
    });
    const gitOverrideWithUnsupportedHost = fragments.record({
      rule: fragments.string('git_override'),
      module_name: fragments.string('rules_foo'),
      remote: fragments.string('https://nobuenos.com/example/rules_foo.git'),
      commit: fragments.string('850cb49c8649e463b80ef7984e7c744279746170'),
    });
    const archiveOverride = fragments.record({
      rule: fragments.string('archive_override'),
      module_name: fragments.string('rules_foo'),
      urls: fragments.string('https://example.com/rules_foo.tar.gz'),
    });
    const localPathOverride = fragments.record({
      rule: fragments.string('local_path_override'),
      module_name: fragments.string('rules_foo'),
      path: fragments.string('/path/to/module'),
    });

    it.each`
      msg                                 | a                                 | exp
      ${'bazel_dep'}                      | ${bazelDepWithoutDevDep}          | ${bazelDepPkgDep}
      ${'git_override, GitHub host'}      | ${gitOverrideWithGihubHost}       | ${gitOverrideForGithubPkgDep}
      ${'git_override, unsupported host'} | ${gitOverrideWithUnsupportedHost} | ${gitOverrideForUnsupportedPkgDep}
      ${'archive_override'}               | ${archiveOverride}                | ${archiveOverridePkgDep}
      ${'local_path_override'}            | ${localPathOverride}              | ${localPathOverridePkgDep}
    `('.parse() with $msg', ({ a, exp }) => {
      const pkgDep = RuleToBazelModulePackageDep.parse(a);
      expect(pkgDep).toEqual(exp);
    });
  });

  describe('.toPackageDependencies()', () => {
    const expectedBazelDepNoOverrides: PackageDependency[] = [bazelDepPkgDep];
    const expectedBazelDepAndGitOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, { skipReason: 'git-dependency' }),
      overrideToPackageDependency(gitOverrideForGithubPkgDep),
    ];
    const expectedBazelDepAndArchiveOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, { skipReason: 'file-dependency' }),
      overrideToPackageDependency(archiveOverridePkgDep),
    ];
    const expectedBazelDepAndLocalPathOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, { skipReason: 'local-dependency' }),
      overrideToPackageDependency(localPathOverridePkgDep),
    ];

    it.each`
      msg                                  | a                                               | exp
      ${'bazel_dep, no overrides'}         | ${[bazelDepPkgDep]}                             | ${expectedBazelDepNoOverrides}
      ${'bazel_dep & git_override'}        | ${[bazelDepPkgDep, gitOverrideForGithubPkgDep]} | ${expectedBazelDepAndGitOverride}
      ${'git_override, no bazel_dep'}      | ${[gitOverrideForGithubPkgDep]}                 | ${[]}
      ${'bazel_dep & archive_override'}    | ${[bazelDepPkgDep, archiveOverridePkgDep]}      | ${expectedBazelDepAndArchiveOverride}
      ${'bazel_dep & local_path_override'} | ${[bazelDepPkgDep, localPathOverridePkgDep]}    | ${expectedBazelDepAndLocalPathOverride}
    `('with $msg', ({ a, exp }) => {
      const result = toPackageDependencies(a);
      expect(result).toEqual(exp);
    });
  });

  describe('.overrideToPackageDependency()', () => {
    it('removes the properties specific to OverridePackageDep', () => {
      const result = overrideToPackageDependency(gitOverrideForGithubPkgDep);
      expect(result).toEqual({
        datasource: GithubTagsDatasource.id,
        depType: 'git_override',
        depName: 'rules_foo',
        packageName: 'example/rules_foo',
        currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
      });
    });
  });

  describe('.processModulePkgDeps', () => {
    it('returns an empty array if the input is an empty array', () => {
      expect(processModulePkgDeps([])).toHaveLength(0);
    });

    it('returns the bazel_dep if more than one override is found', () => {
      const bazelDep: BasePackageDep = {
        depType: 'bazel_dep',
        depName: 'rules_foo',
        currentValue: '1.2.3',
      };
      const override0: OverridePackageDep = {
        depType: 'git_override',
        depName: 'rules_foo',
        bazelDepSkipReason: 'git-dependency',
      };
      const override1: OverridePackageDep = {
        depType: 'bar_override',
        depName: 'rules_foo',
        bazelDepSkipReason: 'unsupported-datasource',
      };
      const pkgDeps: BazelModulePackageDep[] = [bazelDep, override0, override1];
      expect(processModulePkgDeps(pkgDeps)).toEqual([bazelDep]);
    });
  });
});
