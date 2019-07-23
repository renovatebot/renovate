import { RangeStrategy } from '../versioning';

export interface ManagerConfig {
  depType?: string;

  localDir?: string;
  manager?: string;

  packageJsonType?: 'app';

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
  registryUrls?: (string | Registry)[];
  deps: PackageDependency[];
  manager?: string;

  packageFile?: string;
}

export interface Package {
  currentValue?: string;
  currentDigest?: string;
  depName?: string;
  depType?: string;

  managerData?: Record<string, any>;
  versionScheme?: string;
}

export interface PackageDependency extends Package {
  commitMessageTopic?: string;
  currentDigestShort?: string;
  datasource?: string;
  def?: string;
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

export interface Upgrade extends Package {
  newDigest?: string;
  newFrom?: string;
  newValue?: string;
}

export interface ManagerApi {
  language?: string;
  supportsLockFileMaintenance?: boolean;

  extractAllPackageFiles?(
    config: ManagerConfig,
    files: string[]
  ): PackageFile[];

  extractPackageFile?(
    content: string,
    packageFile?: string,
    config?: ManagerConfig
  ): PackageFile | Promise<PackageFile>;

  getPackageUpdates(config: ManagerConfig): any[];

  getRangeStrategy(config: ManagerConfig): RangeStrategy;

  updateArtifacts?(
    packageFileName: string,
    updatedDeps: any,
    newPackageFileContent: string,
    config: ManagerConfig
  ): any;

  updateDependency(fileContent: string, upgrade: Upgrade): string;
}
