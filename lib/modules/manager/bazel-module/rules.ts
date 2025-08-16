import is from '@sindresorhus/is';
import parseGithubUrl from 'github-url-from-git';
import { z } from 'zod';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { clone } from '../../../util/clone';
import { regEx } from '../../../util/regex';
import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency } from '../types';
import { RuleFragment, StringFragment } from './parser/fragments';

// Rule Schemas

export interface BasePackageDep extends PackageDependency {
  depType: string;
  depName: string;
}

type BasePackageDepMergeKeys = Extract<keyof BasePackageDep, 'registryUrls'>;

export interface MergePackageDep extends BasePackageDep {
  // The fields that should be copied from this struct to the bazel_dep
  // PackageDependency.
  bazelDepMergeFields: BasePackageDepMergeKeys[];
}

export interface OverridePackageDep extends BasePackageDep {
  // This value is set as the skipReason on the bazel_dep PackageDependency.
  bazelDepSkipReason: SkipReason;
}

export type BazelModulePackageDep =
  | BasePackageDep
  | OverridePackageDep
  | MergePackageDep;

function isOverride(value: BazelModulePackageDep): value is OverridePackageDep {
  return 'bazelDepSkipReason' in value;
}

function isMerge(value: BazelModulePackageDep): value is MergePackageDep {
  return 'bazelDepMergeFields' in value;
}

// This function exists to remove properties that are specific to
// BazelModulePackageDep. In theory, there is no harm in leaving the properties
// as it does not invalidate the PackageDependency interface. However, it might
// be surprising to someone outside the bazel-module code to see the extra
// properties.
export function bazelModulePackageDepToPackageDependency(
  bmpd: BazelModulePackageDep,
): PackageDependency {
  const copy: BazelModulePackageDep = clone(bmpd);
  if (isOverride(copy)) {
    const partial = copy as Partial<OverridePackageDep>;
    delete partial.bazelDepSkipReason;
  }
  if (isMerge(copy)) {
    const partial = copy as Partial<MergePackageDep>;
    delete partial.bazelDepMergeFields;
  }
  return copy;
}

const BazelDepToPackageDep = RuleFragment.extend({
  rule: z.literal('bazel_dep'),
  children: z.object({
    name: StringFragment,
    version: StringFragment.optional(),
  }),
}).transform(
  ({ rule, children: { name, version } }): BasePackageDep => ({
    datasource: BazelDatasource.id,
    depType: rule,
    depName: name.value,
    currentValue: version?.value,
    ...(version ? {} : { skipReason: 'unspecified-version' }),
  }),
);

const GitOverrideToPackageDep = RuleFragment.extend({
  rule: z.literal('git_override'),
  children: z.object({
    module_name: StringFragment,
    remote: StringFragment,
    commit: StringFragment,
  }),
}).transform(
  ({
    rule,
    children: { module_name: moduleName, remote, commit },
  }): OverridePackageDep => {
    const override: OverridePackageDep = {
      depType: rule,
      depName: moduleName.value,
      bazelDepSkipReason: 'git-dependency',
      currentDigest: commit.value,
    };
    const ghPackageName = githubPackageName(remote.value);
    if (is.nonEmptyString(ghPackageName)) {
      override.datasource = GithubTagsDatasource.id;
      override.packageName = ghPackageName;
    } else {
      override.skipReason = 'unsupported-datasource';
    }
    return override;
  },
);

const SingleVersionOverrideToPackageDep = RuleFragment.extend({
  rule: z.literal('single_version_override'),
  children: z.object({
    module_name: StringFragment,
    version: StringFragment.optional(),
    registry: StringFragment.optional(),
  }),
}).transform(
  ({
    rule,
    children: { module_name: moduleName, version, registry },
  }): BasePackageDep => {
    const base: BasePackageDep = {
      depType: rule,
      depName: moduleName.value,
      skipReason: 'ignored',
    };
    // If a version is specified, then add a skipReason to bazel_dep
    if (version) {
      const override = base as OverridePackageDep;
      override.bazelDepSkipReason = 'is-pinned';
      override.currentValue = version.value;
    }
    // If a registry is specified, then merge it into the bazel_dep
    if (registry) {
      const merge = base as MergePackageDep;
      merge.bazelDepMergeFields = ['registryUrls'];
      merge.registryUrls = [registry.value];
    }
    return base;
  },
);

const UnsupportedOverrideToPackageDep = RuleFragment.extend({
  rule: z.enum(['archive_override', 'local_path_override']),
  children: z.object({
    module_name: StringFragment,
  }),
}).transform(
  ({ rule, children: { module_name: moduleName } }): OverridePackageDep => {
    let bazelDepSkipReason: SkipReason = 'unsupported';
    switch (rule) {
      case 'archive_override':
        bazelDepSkipReason = 'file-dependency';
        break;
      case 'local_path_override':
        bazelDepSkipReason = 'local-dependency';
        break;
    }
    return {
      depType: rule,
      depName: moduleName.value,
      skipReason: 'unsupported-datasource',
      bazelDepSkipReason,
    };
  },
);

export const RuleToBazelModulePackageDep = z.union([
  BazelDepToPackageDep,
  GitOverrideToPackageDep,
  SingleVersionOverrideToPackageDep,
  UnsupportedOverrideToPackageDep,
]);

const githubRemoteRegex = regEx(
  /^https:\/\/github\.com\/(?<packageName>[^/]+\/.+)$/,
);
function githubPackageName(remote: string): string | undefined {
  return parseGithubUrl(remote)?.match(githubRemoteRegex)?.groups?.packageName;
}

function collectByModule(
  packageDeps: BazelModulePackageDep[],
): BazelModulePackageDep[][] {
  const rulesByModule = new Map<string, BasePackageDep[]>();
  for (const pkgDep of packageDeps) {
    const bmi = rulesByModule.get(pkgDep.depName) ?? [];
    bmi.push(pkgDep);
    rulesByModule.set(pkgDep.depName, bmi);
  }
  return Array.from(rulesByModule.values());
}

export function processModulePkgDeps(
  packageDeps: BazelModulePackageDep[],
): PackageDependency[] {
  if (!packageDeps.length) {
    return [];
  }
  const moduleName = packageDeps[0].depName;
  const bazelDep = packageDeps.find((pd) => pd.depType === 'bazel_dep');
  if (!bazelDep) {
    logger.debug(`A 'bazel_dep' was not found for '${moduleName}'.`);
    return [];
  }
  // Create a new bazelDep that will be modified. We do not want to change the
  // input.
  const bazelDepOut = { ...bazelDep };
  const deps: PackageDependency[] = [bazelDepOut];
  const merges = packageDeps.filter(isMerge);
  for (const merge of merges) {
    merge.bazelDepMergeFields.forEach((k) => (bazelDepOut[k] = merge[k]));
  }
  const overrides = packageDeps.filter(isOverride);
  if (overrides.length === 0) {
    return deps;
  }
  // It is an error for more than one override to exist for a module. We will
  // ignore the overrides if there is more than one.
  if (overrides.length > 1) {
    const depTypes = overrides.map((o) => o.depType);
    logger.debug(
      { depName: moduleName, depTypes },
      'More than one override for a module was found',
    );
    return deps;
  }
  const override = overrides[0];
  deps.push(bazelModulePackageDepToPackageDependency(override));
  bazelDepOut.skipReason = override.bazelDepSkipReason;
  return deps;
}

export function toPackageDependencies(
  packageDeps: BazelModulePackageDep[],
): PackageDependency[] {
  return collectByModule(packageDeps).map(processModulePkgDeps).flat();
}

export const GitRepositoryToPackageDep = RuleFragment.extend({
  rule: z.union([z.literal('git_repository'), z.literal('new_git_repository')]),
  children: z.object({
    name: StringFragment,
    remote: StringFragment,
    commit: StringFragment.optional(),
    tag: StringFragment.optional(),
  }),
}).transform(
  ({ rule, children: { name, remote, commit, tag } }): BasePackageDep => {
    const gitRepo: BasePackageDep = {
      depType: rule,
      depName: name.value,
    };

    if (commit?.value) {
      gitRepo.currentDigest = commit.value;
    }

    if (tag?.value) {
      gitRepo.currentValue = tag.value;
    }

    const ghPackageName = githubPackageName(remote.value);
    if (is.nonEmptyString(ghPackageName)) {
      gitRepo.datasource = GithubTagsDatasource.id;
      gitRepo.packageName = ghPackageName;
    } else {
      gitRepo.skipReason = 'unsupported-datasource';
    }
    return gitRepo;
  },
);
