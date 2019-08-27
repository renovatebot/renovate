import { Range } from 'semver';

export type RenovateConfigStage =
  | 'global'
  | 'repository'
  | 'package'
  | 'branch'
  | 'pr';

// TODO: Proper typings
export interface RenovateSharedConfig {
  automerge?: boolean;
  enabled?: boolean;
  managers?: string | string[];

  schedule?: string | string[];

  semanticCommitType?: string;
}

type UpdateConfig<
  T extends RenovateSharedConfig = RenovateSharedConfig
> = Partial<Record<UpdateType, T>>;

// TODO: Proper typings
export interface RenovateConfig
  extends RenovateSharedConfig,
    UpdateConfig<PackageRule>,
    Record<string, any> {
  baseBranches?: string[];

  errors?: ValidationMessage[];
  packageRules?: PackageRule[];

  privateKey?: string | Buffer;

  warnings?: ValidationMessage[];
}

export type UpdateType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'pin'
  | 'digest'
  | 'lockFileMaintenance'
  | 'rollback'
  | 'bump';

// TODO: Proper typings
export interface PackageRule
  extends RenovateSharedConfig,
    UpdateConfig,
    Record<string, any> {
  paths?: string[];
  languages?: string[];
  baseBranchList?: string[];
  datasources?: string[];
  depTypeList?: string[];
  packageNames?: string[];
  packagePatterns?: string[];
  excludePackageNames?: string[];
  excludePackagePatterns?: string[];
  matchCurrentVersion?: string | Range;
  sourceUrlPrefixes?: string[];

  updateTypes?: UpdateType[];
}

export interface ValidationMessage {
  depName: string;
  message: string;
}
