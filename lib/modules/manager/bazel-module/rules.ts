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

export type BazelModulePackageDep = BasePackageDep | OverridePackageDep;

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
  const copy: Partial<OverridePackageDep> = { ...override };
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
    const ghPackageName = githubPackageName(remote.value);
    if (is.nonEmptyString(ghPackageName)) {
      override.datasource = GithubTagsDatasource.id;
      override.packageName = ghPackageName;
    } else {
      override.skipReason = 'unsupported-datasource';
    }
    return override;
  }
);

const UnsupportedOverrideToPackageDep = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.enum(['archive_override', 'local_path_override']),
    }),
    module_name: StringFragmentSchema,
  }),
}).transform(
  ({ children: { rule, module_name: moduleName } }): OverridePackageDep => {
    let bazelDepSkipReason: SkipReason = 'unsupported';
    switch (rule.value) {
      case 'archive_override':
        bazelDepSkipReason = 'file-dependency';
        break;
      case 'local_path_override':
        bazelDepSkipReason = 'local-dependency';
        break;
    }
    return {
      depType: rule.value,
      depName: moduleName.value,
      skipReason: 'unsupported-datasource',
      bazelDepSkipReason,
    };
  }
);

export const RuleToBazelModulePackageDep = z.union([
  BazelDepToPackageDep,
  GitOverrideToPackageDep,
  UnsupportedOverrideToPackageDep,
]);

const githubRemoteRegex = regEx(
  /^https:\/\/github\.com\/(?<packageName>[^/]+\/.+)$/
);
function githubPackageName(remote: string): string | undefined {
  return parseGithubUrl(remote)?.match(githubRemoteRegex)?.groups?.packageName;
}

function collectByModule(
  packageDeps: BazelModulePackageDep[]
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
  const deps: PackageDependency[] = [bazelDep];
  const overrides = packageDeps.filter(isOverride);
  // It is an error for more than one override to exist for a module. We will
  // ignore the overrides if there is more than one.
  if (overrides.length !== 1) {
    const depTypes = overrides.map((o) => o.depType);
    logger.debug(
      { depName: moduleName, depTypes },
      'More than one override for a module was found'
    );
    return deps;
  }
  const override = overrides[0];
  deps.push(overrideToPackageDependency(override));
  bazelDep.skipReason = override.bazelDepSkipReason;
  return deps;
}

export function toPackageDependencies(
  packageDeps: BazelModulePackageDep[]
): PackageDependency[] {
  return collectByModule(packageDeps).map(processModulePkgDeps).flat();
}
