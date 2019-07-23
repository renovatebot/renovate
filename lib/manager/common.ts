import { RangeStrategy } from '../versioning';

export type Result<T> = T | Promise<T>;

export interface ManagerConfig {
  binarySource?: string;
  localDir?: string;
}

export interface ExtractConfig extends ManagerConfig {
  gradle?: { timeout?: number };
  endpoint?: string;
}

export interface UpdateArtifactsConfig extends ManagerConfig {
  isLockFileMaintenance?: boolean;
  compatibility?: Record<string, string>;
  cacheDir?: string;
  postUpdateOptions?: string[];
  registryUrls?: (string | Registry)[];
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

  packageFile?: string;
}

export interface Package<T> {
  checksumLineNumber?: number;

  currentValue?: string;
  currentDigest?: string;
  def?: string;
  depName?: string;
  depType?: string;

  gradleWrapperType?: string;

  managerData?: T;
  lineNumber?: number;
  repo?: string;
  target?: string;
  versionScheme?: string;
}

export interface PackageDependency<T = Record<string, any>> extends Package<T> {
  commitMessageTopic?: string;
  currentDigestShort?: string;
  datasource?: string;
  depNameShort?: string;
  digestOneAndOnly?: boolean;
  fileReplacePosition?: number;
  lockedVersion?: string;
  lookupName?: string;
  lookupType?: string;
  remote?: string;
  registryUrls?: string[];
  rangeStrategy?: RangeStrategy;
  skipReason?: string;
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
