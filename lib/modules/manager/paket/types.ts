export interface DependenciesFile {
  groups: DependenciesFileGroup[];
}
export interface DependenciesFileGroup {
  groupName: string;
  nugetPackages: DependenciesFilePackage[];
}
export interface DependenciesFilePackage {
  name: string;
  versionConstraint?: string;
  options: string[];
}

export interface PaketManagerData extends Record<string, any> {
  group: string;
}

export type LockFileSourceType = 'nuget';
export interface LockFileDependency {
  source: LockFileSourceType;
  groupName: string;
  remote: string;
  packageName: string;
  version: string;
}

export interface UpdatePackage {
  packageName?: string;
  group?: string;
  version?: string;
}
