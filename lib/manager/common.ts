import { RangeStrategy } from '../versioning';

export type Result<T> = T | Promise<T>;

export interface ManagerConfig {
  compatibility?: Record<string, string>;
  gradle?: { timeout?: number };
  binarySource?: string;
  cacheDir?: any;
  depType?: string;
  endpoint?: string;

  localDir?: string;
  manager?: string;

  packageJsonType?: 'app';
  postUpdateOptions?: string[];

  rangeStrategy?: RangeStrategy;
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
  currentValue?: string;
  currentDigest?: string;
  depName?: string;
  depType?: string;

  managerData?: T;
  versionScheme?: string;
}

export interface PackageDependency<T = Record<string, any>> extends Package<T> {
  commitMessageTopic?: string;
  currentDigestShort?: string;
  datasource?: string;
  def?: string;
  depNameShort?: string;
  digestOneAndOnly?: boolean;
  fileReplacePosition?: number;
  lockedVersion?: string;
  lookupName?: string;
  lookupType?: string;
  remote?: string;
  registryUrls?: string[];
  repo?: string;

  rangeStrategy?: RangeStrategy;

  skipReason?: string;
  target?: string;
}

export interface Upgrade<T = Record<string, any>> extends Package<T> {
  currentVersion?: string;
  def?: string;
  depGroup?: string;
  name?: string;
  newDigest?: string;
  newFrom?: string;
  newMajor?: number;
  newValue?: string;
  packageFile?: string;
  repo?: string;
  target?: string;
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
    config: ManagerConfig,
    files: string[]
  ): Result<PackageFile[]>;

  extractPackageFile?(
    content: string,
    packageFile?: string,
    config?: ManagerConfig
  ): Result<PackageFile>;

  getPackageUpdates(config: ManagerConfig): any[];

  getRangeStrategy(config: ManagerConfig): RangeStrategy;

  updateArtifacts?(
    packageFileName: string,
    updatedDeps: string[],
    newPackageFileContent: string,
    config: ManagerConfig
  ): Result<UpdateArtifactsResult[]>;

  updateDependency(fileContent: string, upgrade: Upgrade): string;
}
