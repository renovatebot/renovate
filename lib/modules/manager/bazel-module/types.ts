import type { SkipReason } from '../../../types/index.ts';
import type { PackageDependency } from '../types.ts';

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
