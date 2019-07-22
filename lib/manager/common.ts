import { RangeStrategy } from '../versioning';

export interface ManagerConfig {
  depType?: string;

  localDir?: string;
  manager?: string;

  packageJsonType?: 'app';

  rangeStrategy?: RangeStrategy;
}

export interface PackageFile {
  compatibility?: Record<string, string>;
  registryUrls?: string[];
  deps: PackageDependency[];
  manager?: string;

  packageFile?: string;
}

export interface Package {
  currentValue?: string;
  currentDigest?: string;
  depName?: string;

  managerData?: Record<string, any>;
}

export interface PackageDependency extends Package {
  target?: string;
  def?: string;
  lookupType?: string;
  repo?: string;
  digestOneAndOnly?: boolean;
  currentDigestShort?: string;
  lookupName?: string;
  remote?: string;
  commitMessageTopic?: string;
  datasource?: string;
  depType?: string;

  skipReason?: string;

  versionScheme?: string;
}

export interface Upgrade extends Package {
  newFrom?: string;
  newValue?: string;

  versionScheme?: string;
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
  ): PackageFile;

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
