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
  branchName?: string;
  enabled?: boolean;
  ignoreDeps?: string[];
  labels?: string[];
  managers?: string | string[];
  schedule?: string | string[];

  semanticCommits?: boolean;
  semanticCommitScope?: string;
  semanticCommitType?: string;
  statusCheckVerify?: boolean;
}

type UpdateConfig<
  T extends RenovateSharedConfig = RenovateSharedConfig
> = Partial<Record<UpdateType, T>>;

export type RenovateRepository =
  | string
  | {
      repository: string;
    };

// TODO: Proper typings
export interface RenovateConfig
  extends RenovateSharedConfig,
    UpdateConfig<PackageRule>,
    Record<string, any> {
  baseBranch?: string;
  baseBranches?: string[];
  branchList?: string[];
  description?: string[];
  dryRun?: boolean;
  errors?: ValidationMessage[];
  includeForks?: boolean;
  isFork?: boolean;
  onboarding?: boolean;
  onboardingConfig?: RenovateSharedConfig;
  packageRules?: PackageRule[];
  privateKey?: string | Buffer;
  repoIsOnboarded?: boolean;
  repositories?: RenovateRepository[];
  requireConfig?: boolean;
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
