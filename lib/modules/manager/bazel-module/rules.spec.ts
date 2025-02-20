import { codeBlock } from 'common-tags';
import deepmerge from 'deepmerge';
import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency } from '../types';
import { parse } from './parser';
import type {
  BasePackageDep,
  BazelModulePackageDep,
  MergePackageDep,
  OverridePackageDep,
} from './rules';
import {
  GitRepositoryToPackageDep,
  RuleToBazelModulePackageDep,
  bazelModulePackageDepToPackageDependency,
  processModulePkgDeps,
  toPackageDependencies,
} from './rules';

const customRegistryUrl = 'https://example.com/custom_registry';

const bazelDepPkgDep: BasePackageDep = {
  datasource: BazelDatasource.id,
  depType: 'bazel_dep',
  depName: 'rules_foo',
  currentValue: '1.2.3',
};
const bazelDepPkgDepNoVersion: BasePackageDep = {
  datasource: BazelDatasource.id,
  depType: 'bazel_dep',
  depName: 'rules_foo',
  currentValue: undefined,
  skipReason: 'unspecified-version',
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
const singleVersionOverridePkgDep: OverridePackageDep & MergePackageDep = {
  depType: 'single_version_override',
  depName: 'rules_foo',
  skipReason: 'ignored',
  bazelDepSkipReason: 'is-pinned',
  currentValue: '1.2.3',
  bazelDepMergeFields: ['registryUrls'],
  registryUrls: [customRegistryUrl],
};
const singleVersionOverrideWithRegistryPkgDep: MergePackageDep = {
  depType: 'single_version_override',
  depName: 'rules_foo',
  skipReason: 'ignored',
  bazelDepMergeFields: ['registryUrls'],
  registryUrls: [customRegistryUrl],
};
const singleVersionOverrideWithoutVersionAndRegistryPkgDep: BasePackageDep = {
  depType: 'single_version_override',
  depName: 'rules_foo',
  skipReason: 'ignored',
};
const gitRepositoryForGithubPkgDep: BasePackageDep = {
  datasource: GithubTagsDatasource.id,
  depType: 'git_repository',
  depName: 'rules_foo',
  packageName: 'example/rules_foo',
  currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
};
const gitRepositoryForUnsupportedPkgDep: BasePackageDep = {
  depType: 'git_repository',
  depName: 'rules_foo',
  currentDigest: '850cb49c8649e463b80ef7984e7c744279746170',
  skipReason: 'unsupported-datasource',
};

describe('modules/manager/bazel-module/rules', () => {
  describe('RuleToBazelModulePackageDep', () => {
    const bazelDepWithoutDevDep = codeBlock`
      bazel_dep(name = "rules_foo", version = "1.2.3")`;

    const bazelDepWithoutDevDepNoVersion = codeBlock`
      bazel_dep(name = "rules_foo")`;

    const gitOverrideWithGihubHost = codeBlock`
      git_override(
        module_name = "rules_foo",
        remote = "https://github.com/example/rules_foo.git",
        commit = "850cb49c8649e463b80ef7984e7c744279746170",
      )`;

    const gitOverrideWithUnsupportedHost = codeBlock`
      git_override(
        module_name = "rules_foo",
        remote = "https://nobuenos.com/example/rules_foo.git",
        commit = "850cb49c8649e463b80ef7984e7c744279746170",
      )`;

    const archiveOverride = codeBlock`
      archive_override(
        module_name = "rules_foo",
        urls = "https://example.com/rules_foo.tar.gz",
      )`;

    const localPathOverride = codeBlock`
      local_path_override(
        module_name = "rules_foo",
        path = "/path/to/module",
      )`;

    const singleVersionOverride = codeBlock`
      single_version_override(
        module_name = "rules_foo",
        version = "1.2.3",
        registry = "${customRegistryUrl}",
      )`;

    const singleVersionOverrideWithRegistry = codeBlock`
      single_version_override(
        module_name = "rules_foo",
        registry = "${customRegistryUrl}",
      )`;

    it.each`
      msg                                                    | a                                    | exp
      ${'bazel_dep'}                                         | ${bazelDepWithoutDevDep}             | ${bazelDepPkgDep}
      ${'bazel_dep, no version'}                             | ${bazelDepWithoutDevDepNoVersion}    | ${bazelDepPkgDepNoVersion}
      ${'git_override, GitHub host'}                         | ${gitOverrideWithGihubHost}          | ${gitOverrideForGithubPkgDep}
      ${'git_override, unsupported host'}                    | ${gitOverrideWithUnsupportedHost}    | ${gitOverrideForUnsupportedPkgDep}
      ${'archive_override'}                                  | ${archiveOverride}                   | ${archiveOverridePkgDep}
      ${'local_path_override'}                               | ${localPathOverride}                 | ${localPathOverridePkgDep}
      ${'single_version_override with version and registry'} | ${singleVersionOverride}             | ${singleVersionOverridePkgDep}
      ${'single_version_override with registry'}             | ${singleVersionOverrideWithRegistry} | ${singleVersionOverrideWithRegistryPkgDep}
    `('.parse() with $msg', ({ a, exp }) => {
      const pkgDep = RuleToBazelModulePackageDep.parse(parse(a)[0]);
      expect(pkgDep).toEqual(exp);
    });
  });

  describe('GitRepositoryToPackageDep', () => {
    const gitRepositoryWithGihubHost = codeBlock`
      git_repository(
        name = "rules_foo",
        remote = "https://github.com/example/rules_foo.git",
        commit = "850cb49c8649e463b80ef7984e7c744279746170",
      )`;

    const gitRepositoryWithUnsupportedHost = codeBlock`
      git_repository(
        name = "rules_foo",
        remote = "https://nobuenos.com/example/rules_foo.git",
        commit = "850cb49c8649e463b80ef7984e7c744279746170",
      )`;

    it.each`
      msg                                   | a                                   | exp
      ${'git_repository, GitHub host'}      | ${gitRepositoryWithGihubHost}       | ${gitRepositoryForGithubPkgDep}
      ${'git_repository, unsupported host'} | ${gitRepositoryWithUnsupportedHost} | ${gitRepositoryForUnsupportedPkgDep}
    `('.parse() with $msg', ({ a, exp }) => {
      const pkgDep = GitRepositoryToPackageDep.parse(parse(a)[0]);
      expect(pkgDep).toEqual(exp);
    });
  });

  describe('.toPackageDependencies()', () => {
    const expectedBazelDepNoOverrides: PackageDependency[] = [bazelDepPkgDep];
    const expectedBazelDepNoOverridesNoVersion: PackageDependency[] = [
      bazelDepPkgDepNoVersion,
    ];
    const expectedBazelDepAndGitOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, { skipReason: 'git-dependency' }),
      bazelModulePackageDepToPackageDependency(gitOverrideForGithubPkgDep),
    ];
    const expectedBazelDepNoVersionAndGitOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDepNoVersion, { skipReason: 'git-dependency' }),
      bazelModulePackageDepToPackageDependency(gitOverrideForGithubPkgDep),
    ];
    const expectedBazelDepAndSingleVersionOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, {
        skipReason: 'is-pinned',
        registryUrls: [customRegistryUrl],
      }),
      bazelModulePackageDepToPackageDependency(singleVersionOverridePkgDep),
    ];
    const expectedBazelDepNoVersionAndSingleVersionOverride: PackageDependency[] =
      [
        deepmerge(bazelDepPkgDepNoVersion, {
          skipReason: 'is-pinned',
          registryUrls: [customRegistryUrl],
        }),
        bazelModulePackageDepToPackageDependency(singleVersionOverridePkgDep),
      ];
    const expectedBazelDepAndArchiveOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, { skipReason: 'file-dependency' }),
      bazelModulePackageDepToPackageDependency(archiveOverridePkgDep),
    ];
    const expectedBazelDepNoVersionAndArchiveOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDepNoVersion, { skipReason: 'file-dependency' }),
      bazelModulePackageDepToPackageDependency(archiveOverridePkgDep),
    ];
    const expectedBazelDepAndLocalPathOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, { skipReason: 'local-dependency' }),
      bazelModulePackageDepToPackageDependency(localPathOverridePkgDep),
    ];
    const expectedBazelDepNoVersionAndLocalPathOverride: PackageDependency[] = [
      deepmerge(bazelDepPkgDepNoVersion, { skipReason: 'local-dependency' }),
      bazelModulePackageDepToPackageDependency(localPathOverridePkgDep),
    ];
    // If a registry is specified and a version is not specified for a
    // single_version_override, it is merely providing a registry URL for the bazel_dep.
    const expectedBazelDepWithRegistry: PackageDependency[] = [
      deepmerge(bazelDepPkgDep, { registryUrls: [customRegistryUrl] }),
    ];
    const expectedBazelDepNoVersionWithRegistry: PackageDependency[] = [
      deepmerge(bazelDepPkgDepNoVersion, { registryUrls: [customRegistryUrl] }),
    ];

    it.each`
      msg                                                                                | a                                                                                  | exp
      ${'bazel_dep, no overrides'}                                                       | ${[bazelDepPkgDep]}                                                                | ${expectedBazelDepNoOverrides}
      ${'bazel_dep, no overrides, no version'}                                           | ${[bazelDepPkgDepNoVersion]}                                                       | ${expectedBazelDepNoOverridesNoVersion}
      ${'bazel_dep & git_override'}                                                      | ${[bazelDepPkgDep, gitOverrideForGithubPkgDep]}                                    | ${expectedBazelDepAndGitOverride}
      ${'bazel_dep, no version & git_override'}                                          | ${[bazelDepPkgDepNoVersion, gitOverrideForGithubPkgDep]}                           | ${expectedBazelDepNoVersionAndGitOverride}
      ${'git_override, no bazel_dep'}                                                    | ${[gitOverrideForGithubPkgDep]}                                                    | ${[]}
      ${'bazel_dep & archive_override'}                                                  | ${[bazelDepPkgDep, archiveOverridePkgDep]}                                         | ${expectedBazelDepAndArchiveOverride}
      ${'bazel_dep, no version & archive_override'}                                      | ${[bazelDepPkgDepNoVersion, archiveOverridePkgDep]}                                | ${expectedBazelDepNoVersionAndArchiveOverride}
      ${'bazel_dep & local_path_override'}                                               | ${[bazelDepPkgDep, localPathOverridePkgDep]}                                       | ${expectedBazelDepAndLocalPathOverride}
      ${'bazel_dep, no version & local_path_override'}                                   | ${[bazelDepPkgDepNoVersion, localPathOverridePkgDep]}                              | ${expectedBazelDepNoVersionAndLocalPathOverride}
      ${'single_version_override, with version and registry'}                            | ${[bazelDepPkgDep, singleVersionOverridePkgDep]}                                   | ${expectedBazelDepAndSingleVersionOverride}
      ${'bazel_dep, no version & single_version_override, with version and registry'}    | ${[bazelDepPkgDepNoVersion, singleVersionOverridePkgDep]}                          | ${expectedBazelDepNoVersionAndSingleVersionOverride}
      ${'single_version_override, with registry'}                                        | ${[bazelDepPkgDep, singleVersionOverrideWithRegistryPkgDep]}                       | ${expectedBazelDepWithRegistry}
      ${'bazel_dep, no version & single_version_override, with registry'}                | ${[bazelDepPkgDepNoVersion, singleVersionOverrideWithRegistryPkgDep]}              | ${expectedBazelDepNoVersionWithRegistry}
      ${'single_version_override, without version and registry'}                         | ${[bazelDepPkgDep, singleVersionOverrideWithoutVersionAndRegistryPkgDep]}          | ${[bazelDepPkgDep]}
      ${'bazel_dep, no version & single_version_override, without version and registry'} | ${[bazelDepPkgDepNoVersion, singleVersionOverrideWithoutVersionAndRegistryPkgDep]} | ${[bazelDepPkgDepNoVersion]}
    `('with $msg', ({ msg, a, exp }) => {
      const result = toPackageDependencies(a);
      expect(result).toEqual(exp);
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
