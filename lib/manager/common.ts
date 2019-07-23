import { RangeStrategy } from '../versioning';

export type Result<T> = T | Promise<T>;

export interface ManagerConfig {
  binarySource?: string;
  localDir?: string;
  registryUrls?: (string | Registry)[];
}

export interface ExtractConfig extends ManagerConfig {
  gradle?: { timeout?: number };
  endpoint?: string;
  versionScheme?: string;
}

export interface UpdateArtifactsConfig extends ManagerConfig {
  isLockFileMaintenance?: boolean;
  compatibility?: Record<string, string>;
  cacheDir?: string;
  postUpdateOptions?: string[];
}

export interface PackageUpdateConfig {
  currentValue?: string;
  rangeStrategy?: RangeStrategy;
  supportPolicy?: string[];
}

export interface PackageUpdateResult {
  newValue: string[];
  newMajor: string;
  isRange: boolean;
  sourceUrl: string;
}

export interface RangeConfig {
  composerJsonType?: 'composer-plugin' | 'library' | 'metapackage' | 'project';
  currentValue?: string;
  depName?: string;
  depType?: string;
  manager?: string;
  packageJsonType?: 'app' | 'library';
  rangeStrategy: RangeStrategy;
}

export interface Registry {
  type?: string;
  url: string;
}

export interface PackageFile {
  composerJsonType?: string;
  composerLock?: boolean | string;
  compatibility?: Record<string, string>;
  datasource?: string;
  registryUrls?: (string | Registry)[];
  deps: PackageDependency[];
  manager?: string;
  mavenProps?: Record<string, any>;
  packageFile?: string;
  parent?: string;
}

export interface Package<T> {
  checksumLineNumber?: number;
  currentValue?: string;
  currentDigest?: string;
  def?: string;
  depName?: string;
  depNameShort?: string;
  depType?: string;
  fileReplacePosition?: number;
  gradleWrapperType?: string;
  groupName?: string;
  lineNumber?: number;
  managerData?: T;
  ownerName?: string;
  pipenvNestedVersion?: boolean;
  repo?: string;
  repoName?: string;
  sha256?: string;
  target?: string;
  url?: string;
  versionScheme?: string;
}

export interface PackageDependency<T = Record<string, any>> extends Package<T> {
  commitMessageTopic?: string;
  currentDigestShort?: string;
  datasource?: string;
  digestOneAndOnly?: boolean;
  fromVersion?: string;
  lockedVersion?: string;
  lookupName?: string;
  lookupType?: string;
  moduleName?: string;
  propSource?: string;
  remote?: string;
  registryUrls?: string[];
  rangeStrategy?: RangeStrategy;
  skipReason?: string;
  source?: string;
  sourceLine?: number;
  versionLine?: number;
}

export interface Upgrade<T = Record<string, any>> extends Package<T> {
  checksumUrl?: string;
  currentVersion?: string;
  depGroup?: string;
  downloadUrl?: string;
  name?: string;
  newDigest?: string;
  newFrom?: string;
  newMajor?: number;
  newValue?: string;
  newVersion?: string;
  packageFile?: string;
  updateType?: string;
  version?: string;
}

interface ArtifactError {
  lockFile?: string;
  stderr?: string;
}

export interface UpdateArtifactsResult {
  artifactError?: ArtifactError;
  file?: { name: string; contents: string };
  lockFileError?: ArtifactError;
}

export interface ManagerApi {
  language?: string;
  supportsLockFileMaintenance?: boolean;

  extractAllPackageFiles?(
    config: ExtractConfig,
    files: string[]
  ): Result<PackageFile[]>;

  extractPackageFile?(
    content: string,
    packageFile?: string,
    config?: ExtractConfig
  ): Result<PackageFile>;

  getPackageUpdates(config: PackageUpdateConfig): PackageUpdateResult[];

  getRangeStrategy(config: RangeConfig): RangeStrategy;

  updateArtifacts?(
    packageFileName: string,
    updatedDeps: string[],
    newPackageFileContent: string,
    config: UpdateArtifactsConfig
  ): Result<UpdateArtifactsResult[]>;

  updateDependency(fileContent: string, upgrade: Upgrade): Result<string>;
}
