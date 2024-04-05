import type { ReleaseType } from 'semver';
import type {
  MatchStringsStrategy,
  UpdateType,
  UserEnv,
  ValidationMessage,
} from '../../config/types';
import type { Category } from '../../constants';
import type { ModuleApi, RangeStrategy, SkipReason } from '../../types';
import type { FileChange } from '../../util/git/types';
import type { MergeConfidence } from '../../util/merge-confidence/types';
import type { CustomExtractConfig } from './custom/types';

export type Result<T> = T | Promise<T>;

export interface ManagerData<T> {
  managerData?: T;
}

export interface ExtractConfig extends CustomExtractConfig {
  registryAliases?: Record<string, string>;
  npmrc?: string;
  npmrcMerge?: boolean;
  skipInstalls?: boolean | null;
  repository?: string;
}

export interface UpdateArtifactsConfig {
  isLockFileMaintenance?: boolean;
  constraints?: Record<string, string>;
  composerIgnorePlatformReqs?: string[];
  goGetDirs?: string[];
  currentValue?: string;
  postUpdateOptions?: string[];
  ignorePlugins?: boolean;
  ignoreScripts?: boolean;
  updateType?: UpdateType;
  newValue?: string;
  newVersion?: string;
  newMajor?: number;
  registryAliases?: Record<string, string>;
  lockFiles?: string[];
  env?: UserEnv;
}

export interface RangeConfig<T = Record<string, any>> extends ManagerData<T> {
  currentValue?: string;
  depName?: string;
  depType?: string;
  manager?: string;
  rangeStrategy: RangeStrategy;
}

export interface PackageFileContent<T = Record<string, any>>
  extends ManagerData<T> {
  autoReplaceStringTemplate?: string;
  extractedConstraints?: Record<string, string>;
  datasource?: string;
  registryUrls?: string[];
  additionalRegistryUrls?: string[];
  deps: PackageDependency[];
  lockFiles?: string[];
  npmrc?: string;
  packageFileVersion?: string;
  skipInstalls?: boolean | null;
  matchStrings?: string[];
  matchStringsStrategy?: MatchStringsStrategy;
}

export interface PackageFile<T = Record<string, any>>
  extends PackageFileContent<T> {
  packageFile: string;
}

export interface LookupUpdate {
  bucket?: string;
  branchName?: string;
  commitMessageAction?: string;
  isBump?: boolean;
  isLockfileUpdate?: boolean;
  isPin?: boolean;
  isPinDigest?: boolean;
  isRange?: boolean;
  isRollback?: boolean;
  isReplacement?: boolean;
  newDigest?: string;
  newMajor?: number;
  newMinor?: number;
  newName?: string;
  newValue?: string;
  semanticCommitType?: string;
  pendingChecks?: boolean;
  pendingVersions?: string[];
  newVersion?: string;
  updateType?: UpdateType;
  mergeConfidenceLevel?: MergeConfidence | undefined;
  userStrings?: Record<string, string>;
  checksumUrl?: string;
  downloadUrl?: string;
  releaseTimestamp?: any;
  registryUrl?: string;
}

/**
 * @property {string} depName - Display name of the package. See #16012
 * @property {string} packageName - The name of the package, used in comparisons. depName is used as fallback if this is not set. See #16012
 */
export interface PackageDependency<T = Record<string, any>>
  extends ManagerData<T> {
  currentValue?: string | null;
  currentDigest?: string;
  depName?: string;
  depType?: string;
  fileReplacePosition?: number;
  groupName?: string;
  lineNumber?: number;
  packageName?: string;
  target?: string;
  versioning?: string;
  dataType?: string;
  enabled?: boolean;
  bumpVersion?: ReleaseType;
  npmPackageAlias?: boolean;
  packageFileVersion?: string;
  gitRef?: boolean;
  sourceUrl?: string | null;
  pinDigests?: boolean;
  currentRawValue?: string;
  major?: { enabled?: boolean };
  prettyDepType?: string;
  newValue?: string;
  warnings?: ValidationMessage[];
  commitMessageTopic?: string;
  currentDigestShort?: string;
  datasource?: string;
  deprecationMessage?: string;
  digestOneAndOnly?: boolean;
  fixedVersion?: string;
  currentVersion?: string;
  lockedVersion?: string;
  propSource?: string;
  registryUrls?: string[] | null;
  rangeStrategy?: RangeStrategy;
  skipReason?: SkipReason;
  sourceLine?: number;
  newVersion?: string;
  updates?: LookupUpdate[];
  replaceString?: string;
  autoReplaceStringTemplate?: string;
  editFile?: string;
  separateMinorPatch?: boolean;
  extractVersion?: string;
  isInternal?: boolean;
  variableName?: string;
  indentation?: string;
}

export interface Upgrade<T = Record<string, any>> extends PackageDependency<T> {
  workspace?: string;
  isLockfileUpdate?: boolean;
  currentRawValue?: any;
  depGroup?: string;
  lockFiles?: string[];
  manager?: string;
  name?: string;
  newDigest?: string;
  newFrom?: string;
  newMajor?: number;
  newName?: string;
  newValue?: string;
  packageFile?: string;
  rangeStrategy?: RangeStrategy;
  newVersion?: string;
  updateType?: UpdateType;
  version?: string;
  isLockFileMaintenance?: boolean;
  isRemediation?: boolean;
  isVulnerabilityAlert?: boolean;
  vulnerabilitySeverity?: string;
  registryUrls?: string[] | null;
  currentVersion?: string;
  replaceString?: string;
}

export interface ArtifactError {
  lockFile?: string;
  stderr?: string;
}

export interface UpdateArtifactsResult {
  artifactError?: ArtifactError;
  file?: FileChange;
}

export interface UpdateArtifact<T = Record<string, unknown>> {
  packageFileName: string;
  updatedDeps: Upgrade<T>[];
  newPackageFileContent: string;
  config: UpdateArtifactsConfig;
}

export interface UpdateDependencyConfig<T = Record<string, any>> {
  fileContent: string;
  upgrade: Upgrade<T>;
}

export interface BumpPackageVersionResult {
  bumpedContent: string | null;
}

export interface UpdateLockedConfig {
  packageFile: string;
  packageFileContent?: string;
  lockFile: string;
  lockFileContent?: string;
  depName: string;
  currentVersion: string;
  newVersion: string;
  allowParentUpdates?: boolean;
  allowHigherOrRemoved?: boolean;
}

export interface UpdateLockedResult {
  status: 'unsupported' | 'updated' | 'already-updated' | 'update-failed';
  files?: Record<string, string>;
}

export interface GlobalManagerConfig {
  npmrc?: string;
  npmrcMerge?: boolean;
}

export interface ManagerApi extends ModuleApi {
  defaultConfig: Record<string, unknown>;

  categories?: Category[];
  supportsLockFileMaintenance?: boolean;
  supersedesManagers?: string[];
  supportedDatasources: string[];

  bumpPackageVersion?(
    content: string,
    currentValue: string,
    bumpVersion: ReleaseType,
    packageFile: string,
  ): Result<BumpPackageVersionResult>;

  detectGlobalConfig?(): Result<GlobalManagerConfig>;

  extractAllPackageFiles?(
    config: ExtractConfig,
    files: string[],
  ): Result<PackageFile[] | null>;

  extractPackageFile?(
    content: string,
    packageFile?: string,
    config?: ExtractConfig,
  ): Result<PackageFileContent | null>;

  getRangeStrategy?(config: RangeConfig): RangeStrategy;

  updateArtifacts?(
    updateArtifact: UpdateArtifact,
  ): Result<UpdateArtifactsResult[] | null>;

  updateDependency?(
    updateDependencyConfig: UpdateDependencyConfig,
  ): Result<string | null>;

  updateLockedDependency?(
    config: UpdateLockedConfig,
  ): Result<UpdateLockedResult>;
}

// TODO: name and properties used by npm manager
export interface PostUpdateConfig<T = Record<string, any>>
  extends Record<string, any>,
    ManagerData<T> {
  // TODO: remove null
  constraints?: Record<string, string> | null;
  updatedPackageFiles?: FileChange[];
  postUpdateOptions?: string[];
  skipInstalls?: boolean | null;
  ignoreScripts?: boolean;

  packageFile?: string;

  upgrades: Upgrade[];
  npmLock?: string;
  yarnLock?: string;
  branchName: string;
  reuseExistingBranch?: boolean;
}
