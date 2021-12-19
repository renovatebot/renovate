import type { ReleaseType } from 'semver';
import type {
  MatchStringsStrategy,
  UpdateType,
  ValidationMessage,
} from '../config/types';
import type { ProgrammingLanguage } from '../constants';
import type { ModuleApi, RangeStrategy, SkipReason } from '../types';
import type { File } from '../util/git/types';

export type Result<T> = T | Promise<T>;

export interface ManagerData<T> {
  managerData?: T;
}

export interface ExtractConfig {
  constraints?: Record<string, string>;
  registryUrls?: string[];
  endpoint?: string;
  gradle?: { timeout?: number };
  aliases?: Record<string, string>;
  npmrc?: string;
  npmrcMerge?: boolean;
  skipInstalls?: boolean;
  updateInternalDeps?: boolean;
  deepExtract?: boolean;
}

export interface CustomExtractConfig extends ExtractConfig {
  autoReplaceStringTemplate?: string;
  matchStrings: string[];
  matchStringsStrategy?: MatchStringsStrategy;
  depNameTemplate?: string;
  lookupNameTemplate?: string;
  datasourceTemplate?: string;
  versioningTemplate?: string;
  depTypeTemplate?: string;
}

export interface UpdateArtifactsConfig {
  isLockFileMaintenance?: boolean;
  constraints?: Record<string, string>;
  composerIgnorePlatformReqs?: string[];
  currentValue?: string;
  postUpdateOptions?: string[];
  ignorePlugins?: boolean;
  ignoreScripts?: boolean;
  updateType?: UpdateType;
  newValue?: string;
  newVersion?: string;
  newMajor?: number;
  aliases?: Record<string, string>;
}

export interface RangeConfig<T = Record<string, any>> extends ManagerData<T> {
  currentValue?: string;
  depName?: string;
  depType?: string;
  manager?: string;
  packageJsonType?: 'app' | 'library';
  rangeStrategy: RangeStrategy;
}

export interface NpmLockFiles {
  yarnLock?: string;
  packageLock?: string;
  shrinkwrapJson?: string;
  pnpmShrinkwrap?: string;
  npmLock?: string;
  lockFiles?: string[];
}

export interface PackageFile<T = Record<string, any>>
  extends NpmLockFiles,
    ManagerData<T> {
  autoReplaceStringTemplate?: string;
  hasYarnWorkspaces?: boolean;
  constraints?: Record<string, string>;
  datasource?: string;
  registryUrls?: string[];
  deps: PackageDependency[];
  lernaClient?: string;
  lernaPackages?: string[];
  mavenProps?: Record<string, any>;
  npmrc?: string;
  packageFile?: string;
  packageJsonName?: string;
  packageJsonType?: 'app' | 'library';
  packageFileVersion?: string;
  parent?: string;
  skipInstalls?: boolean;
  yarnWorkspacesPackages?: string[] | string;
  matchStrings?: string[];
  matchStringsStrategy?: MatchStringsStrategy;
}

export interface Package<T> extends ManagerData<T> {
  currentValue?: string;
  currentDigest?: string;
  depName?: string;
  depType?: string;
  fileReplacePosition?: number;
  groupName?: string;
  lineNumber?: number;
  lookupName?: string;
  repo?: string;
  target?: string;
  versioning?: string;
  dataType?: string;

  // npm manager
  bumpVersion?: ReleaseType | string;
  npmPackageAlias?: boolean;
  packageFileVersion?: string;
  gitRef?: boolean;
  sourceUrl?: string;
  githubRepo?: string;
  pinDigests?: boolean;
  currentRawValue?: string;
  major?: { enabled?: boolean };
  prettyDepType?: any;
}

export interface LookupUpdate {
  bucket?: string;
  branchName?: string;
  commitMessageAction?: string;
  isBump?: boolean;
  isLockfileUpdate?: boolean;
  isPin?: boolean;
  isRange?: boolean;
  isRollback?: boolean;
  isReplacement?: boolean;
  newDigest?: string;
  newMajor?: number;
  newMinor?: number;
  newName?: string;
  newValue: string;
  semanticCommitType?: string;
  pendingChecks?: boolean;
  pendingVersions?: string[];
  newVersion?: string;
  updateType?: UpdateType;
  userStrings?: Record<string, string>;
}

export interface PackageDependency<T = Record<string, any>> extends Package<T> {
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
  registryUrls?: string[];
  rangeStrategy?: RangeStrategy;
  skipReason?: SkipReason;
  sourceLine?: number;
  newVersion?: string;
  updates?: LookupUpdate[];
  replaceString?: string;
  autoReplaceStringTemplate?: string;
  depIndex?: number;
  editFile?: string;
  separateMinorPatch?: boolean;
  extractVersion?: string;
}

export interface Upgrade<T = Record<string, any>>
  extends Package<T>,
    NpmLockFiles {
  isLockfileUpdate?: boolean;
  currentRawValue?: any;
  depGroup?: string;
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
  deepExtract?: boolean;
}

export interface ArtifactError {
  lockFile?: string;
  stderr?: string;
}

export interface UpdateArtifactsResult {
  artifactError?: ArtifactError;
  file?: File;
}

export interface UpdateArtifact {
  packageFileName: string;
  updatedDeps: PackageDependency[];
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
  packageFile?: string;
  packageFileContent?: string;
  lockFile?: string;
  lockFileContent?: string;
  depName?: string;
  currentVersion?: string;
  newVersion?: string;
  allowParentUpdates?: boolean;
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
  language?: ProgrammingLanguage;
  supportsLockFileMaintenance?: boolean;

  bumpPackageVersion?(
    content: string,
    currentValue: string,
    bumpVersion: ReleaseType | string
  ): Result<BumpPackageVersionResult>;

  detectGlobalConfig?(): Result<GlobalManagerConfig>;

  extractAllPackageFiles?(
    config: ExtractConfig,
    files: string[]
  ): Result<PackageFile[] | null>;

  extractPackageFile?(
    content: string,
    packageFile?: string,
    config?: ExtractConfig
  ): Result<PackageFile | null>;

  getRangeStrategy?(config: RangeConfig): RangeStrategy;

  updateArtifacts?(
    updateArtifact: UpdateArtifact
  ): Result<UpdateArtifactsResult[] | null>;

  updateDependency?(
    updateDependencyConfig: UpdateDependencyConfig
  ): Result<string | null>;

  updateLockedDependency?(
    config: UpdateLockedConfig
  ): Result<UpdateLockedResult>;
}

// TODO: name and properties used by npm manager
export interface PostUpdateConfig<T = Record<string, any>>
  extends Record<string, any>,
    ManagerData<T> {
  updatedPackageFiles?: File[];
  postUpdateOptions?: string[];
  skipInstalls?: boolean;
  ignoreScripts?: boolean;

  platform?: string;
  upgrades?: Upgrade[];
  npmLock?: string;
  yarnLock?: string;
  branchName?: string;
  reuseExistingBranch?: boolean;
}
