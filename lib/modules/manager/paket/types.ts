import type { ToolConstraint } from '../../../util/exec/types.ts';

export interface DependenciesFile {
  groups: DependenciesFileGroup[];
}
export interface DependenciesFileGroup {
  groupName: string;
  nugetPackages: DependenciesFilePackage[];
}
export interface DependenciesFilePackage {
  name: string;
  options: string[];
}

export type LockFileSourceType = 'nuget';
export interface LockFileDependency {
  source: LockFileSourceType;
  groupName: string;
  remote: string;
  packageName: string;
  version: string;
}

export interface PaketPackage {
  paketGroupName: string;
}

export interface UpdatePackage {
  filePath: string;
  packageName?: string;
  group?: string;
  version?: string;
  toolConstraints?: ToolConstraint[];
}
