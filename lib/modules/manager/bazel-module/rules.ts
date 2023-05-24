import is from '@sindresorhus/is';
import parseGithubUrl from 'github-url-from-git';
import { z } from 'zod';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { regEx } from '../../../util/regex';
import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency } from '../types';
import { RecordFragmentSchema, StringFragmentSchema } from './fragments';

// Rule Schemas

export interface BasePackageDep extends PackageDependency {
  depType: string;
  depName: string;
}

export interface OverridePackageDep extends BasePackageDep {
  // This value is set as the skipReason on the bazel_dep PackageDependency.
  bazelDepSkipReason: SkipReason;
}

type BazelModulePackageDep = BasePackageDep | OverridePackageDep;

function isOverride(value: BazelModulePackageDep): value is OverridePackageDep {
  return 'bazelDepSkipReason' in value;
}

// This function exists to remove properties that are specific to
// OverridePackageDep. In theory, there is no harm in leaving the properties
// as it does not invalidate the PackageDependency interface. However, it might
// be surprising to someone outside the bazel-module code to see the extra
// properties.
export function overrideToPackageDependency(
  override: OverridePackageDep
): PackageDependency {
  const copy: Partial<OverridePackageDep> = structuredClone(override);
  delete copy.bazelDepSkipReason;
  return copy;
}

const BazelDepToPackageDep = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.literal('bazel_dep'),
    }),
    name: StringFragmentSchema,
    version: StringFragmentSchema,
  }),
}).transform(
  ({ children: { rule, name, version } }): BasePackageDep => ({
    datasource: BazelDatasource.id,
    depType: rule.value,
    depName: name.value,
    currentValue: version.value,
  })
);

const GitOverrideToPackageDep = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.literal('git_override'),
    }),
    module_name: StringFragmentSchema,
    remote: StringFragmentSchema,
    commit: StringFragmentSchema,
  }),
}).transform(
  ({
    children: { rule, module_name: moduleName, remote, commit },
  }): OverridePackageDep => {
    const override: OverridePackageDep = {
      depType: rule.value,
      depName: moduleName.value,
      bazelDepSkipReason: 'git-dependency',
      currentDigest: commit.value,
    };
    if (isGithubRemote(remote.value)) {
      override.datasource = GithubTagsDatasource.id;
      override.packageName = githubPackageName(remote.value);
    } else {
      override.skipReason = 'unsupported-datasource';
    }
    return override;
  }
);

export const RuleToBazelModulePackageDep = z.union([
  BazelDepToPackageDep,
  GitOverrideToPackageDep,
]);

function isGithubRemote(remote: string): boolean {
  return is.truthy(parseGithubUrl(remote));
}

const githubRemoteRegex = regEx(
  /^https:\/\/github\.com\/(?<packageName>[^/]+\/.+)$/
);
function githubPackageName(remote: string): string | undefined {
  return parseGithubUrl(remote)?.match(githubRemoteRegex)?.groups?.packageName;
}

function collectByModule(
  packageDeps: BazelModulePackageDep[]
): BazelModulePackageDep[][] {
  const rulesByModule = packageDeps.reduce((map, pkgDep) => {
    const bmi = map.get(pkgDep.depName) ?? [];
    bmi.push(pkgDep);
    return map.set(pkgDep.depName, bmi);
  }, new Map<string, BasePackageDep[]>());
  return Array.from(rulesByModule.values());
}

export function processModulePkgDeps(
  packageDeps: BazelModulePackageDep[]
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
  const bazelDepOut = structuredClone(bazelDep);
  const deps: PackageDependency[] = [bazelDepOut];
  const overrides = packageDeps.filter(isOverride);
  // It is an error for more than one override to exist for a module. We will
  // ignore the overrides if there is more than one.
  if (overrides.length !== 1) {
    return deps;
  }
  const override = overrides[0];
  deps.push(overrideToPackageDependency(override));
  bazelDepOut.skipReason = override.bazelDepSkipReason;
  return deps;
}

export function toPackageDependencies(
  packageDeps: BazelModulePackageDep[]
): PackageDependency[] {
  return collectByModule(packageDeps).map(processModulePkgDeps).flat();
}
