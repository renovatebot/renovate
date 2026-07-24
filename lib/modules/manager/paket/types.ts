export interface DependenciesFile {
  groups: DependenciesFileGroup[];
}
export interface DependenciesFileGroup {
  groupName: string;
  sources: string[];
  nugetPackages: DependenciesFilePackage[];
}
export interface DependenciesFilePackage {
  name: string;
  versionConstraint?: string;
}

export interface PaketManagerData extends Record<string, any> {
  group: string;
}

export type LockFileSourceType = 'nuget';
export interface LockFileDependency {
  groupName: string;
  packageName: string;
  version: string;
}

export interface UpdatePackage {
  packageName?: string;
  group?: string;
  version?: string;
}
