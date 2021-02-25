export interface PackageLockDependency {
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, PackageLockDependency>;
}

export type PackageLockDependencies = Record<string, PackageLockDependency>;

export interface PackageLockOrEntry {
  lockFileVersion?: number;
  version?: string;
  dependencies?: PackageLockDependencies;
  requires?: Record<string, string>;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface ParentDependency {
  parentDepName?: string;
  parentVersion?: string;
  constraint: string;
  depType?: string;
}
