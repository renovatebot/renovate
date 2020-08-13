import { ReleaseType } from 'semver';
import { GlobalConfig, UpdateType, ValidationMessage } from '../config/common';
import { RangeStrategy, SkipReason } from '../types';
import { File } from '../util/git';

export type Result<T> = T | Promise<T>;

export interface ManagerConfig {
  binarySource?: string;
  dockerUser?: string;
  localDir?: string;
  registryUrls?: string[];
}

export interface ManagerData<T> {
  managerData?: T;
}

export interface ExtractConfig extends ManagerConfig {
  endpoint?: string;
  global?: GlobalConfig;
  gradle?: { timeout?: number };
  aliases?: Record<string, string>;
  ignoreNpmrcFile?: boolean;
  yarnrc?: string;
  skipInstalls?: boolean;
  versioning?: string;
}

export interface CustomExtractConfig extends ExtractConfig {
  matchStrings: string[];
  depNameTemplate?: string;
  lookupNameTemplate?: string;
  datasourceTemplate?: string;
  versioningTemplate?: string;
}

export interface UpdateArtifactsConfig extends ManagerConfig {
  isLockFileMaintenance?: boolean;
  compatibility?: Record<string, string>;
  cacheDir?: string;
  composerIgnorePlatformReqs?: boolean;
  currentValue?: string;
  postUpdateOptions?: string[];
  ignoreScripts?: boolean;

  toVersion?: string;
}

export interface PackageUpdateConfig {
  currentValue?: string;
  rangeStrategy?: RangeStrategy;
  supportPolicy?: string[];
}

export interface RangeConfig<T = Record<string, any>> extends ManagerData<T> {
  composerJsonType?: 'composer-plugin' | 'library' | 'metapackage' | 'project';
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
  lernaDir?: string;
}

export interface PackageFile<T = Record<string, any>>
  extends NpmLockFiles,
    ManagerData<T> {
  hasYarnWorkspaces?: boolean;
  internalPackages?: string[]; // TODO: remove
  compatibility?: Record<string, string>;
  datasource?: string;
  registryUrls?: string[];
  deps: PackageDependency[];
  ignoreNpmrcFile?: boolean;
  lernaClient?: string;
  lernaPackages?: string[];
  manager?: string;
  mavenProps?: Record<string, any>;
  npmrc?: string;
  packageFile?: string;
  packageJsonName?: string;
  packageJsonType?: 'app' | 'library';
  packageJsonVersion?: string;
  parent?: string;
  skipInstalls?: boolean;
  yarnrc?: string;
  yarnWorkspacesPackages?: string[] | string;
  matchStrings?: string[];
}

export interface Package<T> extends ManagerData<T> {
  currentValue?: string;
  currentDigest?: string;
  depName?: string;
  depNameShort?: string;
  depType?: string;
  fileReplacePosition?: number;
  groupName?: string;
  lineNumber?: number;
  lookupName?: string;
  repo?: string;
  target?: string;
  versioning?: string;

  // npm manager
  bumpVersion?: ReleaseType | string;
  npmPackageAlias?: boolean;
  packageJsonVersion?: string;
  gitRef?: boolean;
  sourceUrl?: string;
  githubRepo?: string;
  pinDigests?: boolean;
  currentRawValue?: string;
  major?: { enabled?: boolean };
  prettyDepType?: any;
}

export interface LookupUpdate {
  blockedByPin?: boolean;
  branchName?: string;
  commitMessageAction?: string;
  displayFrom?: string;
  displayTo?: string;
  isLockfileUpdate?: boolean;
  isPin?: boolean;
  isRange?: boolean;
  isRollback?: boolean;
  isSingleVersion?: boolean;
  fromVersion?: string;
  newDigest?: string;
  newDigestShort?: string;
  newMajor?: number;
  newMinor?: number;
  newValue: string;
  newVersion?: string;
  semanticCommitType?: string;
  toVersion?: string;
  updateType?: UpdateType;
  sourceUrl?: string;
}

export interface PackageDependency<T = Record<string, any>> extends Package<T> {
  warnings?: ValidationMessage[];
  commitMessageTopic?: string;
  currentDigestShort?: string;
  datasource?: string;
  deprecationMessage?: string;
  digestOneAndOnly?: boolean;
  displayFrom?: string;
  displayTo?: string;
  fromVersion?: string;
  lockedVersion?: string;
  propSource?: string;
  registryUrls?: string[];
  rangeStrategy?: RangeStrategy;
  skipReason?: SkipReason;
  sourceLine?: number;
  toVersion?: string;
  updates?: LookupUpdate[];
  replaceString?: string;
  autoReplaceStringTemplate?: string;
  depIndex?: number;
  editFile?: string;
  separateMinorPatch?: boolean;
}

export interface Upgrade<T = Record<string, any>>
  extends Package<T>,
    NpmLockFiles {
  isLockfileUpdate?: boolean;
  currentRawValue?: any;
  currentVersion?: string;
  depGroup?: string;
  dockerRepository?: string;
  localDir?: string;
  name?: string;
  newDigest?: string;
  newFrom?: string;
  newMajor?: number;
  newValue?: string;
  newVersion?: string;
  packageFile?: string;
  rangeStrategy?: RangeStrategy;
  toVersion?: string;
  updateType?: UpdateType;
  version?: string;
  isLockFileMaintenance?: boolean;
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
  updatedDeps: string[];
  newPackageFileContent: string;
  config: UpdateArtifactsConfig;
}

export interface UpdateDependencyConfig {
  fileContent: string;
  upgrade: Upgrade;
}

export interface ManagerApi {
  defaultConfig: object;
  language?: string;
  supportsLockFileMaintenance?: boolean;

  extractAllPackageFiles?(
    config: ExtractConfig,
    files: string[]
  ): Result<PackageFile[] | null>;

  extractPackageFile?(
    content: string,
    packageFile?: string,
    config?: ExtractConfig
  ): Result<PackageFile | null>;

  getPackageUpdates?(config: PackageUpdateConfig): Result<LookupUpdate[]>;

  getRangeStrategy?(config: RangeConfig): RangeStrategy;

  updateArtifacts?(
    updateArtifact: UpdateArtifact
  ): Result<UpdateArtifactsResult[] | null>;

  updateDependency?(
    updateDependencyConfig: UpdateDependencyConfig
  ): Result<string | null>;
}

// TODO: name and properties used by npm manager
export interface PostUpdateConfig extends ManagerConfig, Record<string, any> {
  cacheDir?: string;

  postUpdateOptions?: string[];
  skipInstalls?: boolean;

  platform?: string;
  upgrades?: Upgrade[];
  npmLock?: string;
  yarnLock?: string;
  branchName?: string;
  reuseExistingBranch?: boolean;
}
