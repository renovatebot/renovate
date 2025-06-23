export interface PackageLockDependency {
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, PackageLockDependency>;

  bundled?: boolean;
}

export type PackageLockDependencies = Record<string, PackageLockDependency>;

export interface PackageLockOrEntry {
  lockfileVersion?: number;
  version?: string;
  dependencies?: PackageLockDependencies;
  requires?: Record<string, string>;

  bundled?: boolean;
}

export interface ParentDependency {
  parentDepName?: string;
  parentVersion?: string;
  constraint: string;
  depType?: string;
}
