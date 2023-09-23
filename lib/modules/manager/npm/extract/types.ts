import type { PackageJson } from 'type-fest';

export type NpmPackageDependency = PackageJson.Dependency;
export type DependenciesMeta = Record<
  string,
  { optional: boolean; built: boolean; unplugged: boolean }
>;

export type NpmPackage = PackageJson & {
  renovate?: unknown;
  _from?: any;
  _args?: any;
  _id?: any;
  dependenciesMeta?: DependenciesMeta;
  overrides?: OverrideDependency;
  volta?: PackageJson.Dependency;
};

export type LockFileEntry = Record<
  string,
  { version: string; integrity?: boolean }
>;

export interface LockFile {
  lockedVersions?: Record<string, string>;
  lockedVersionsWithPath?: Record<
    string,
    Record<string, Record<string, string>>
  >;
  lockfileVersion?: number; // cache version for Yarn
  isYarn1?: boolean;
}

export interface PnpmWorkspaceFile {
  packages: string[];
}

export type OverrideDependency = Record<string, RecursiveOverride>;

export type RecursiveOverride = string | { [_: string]: RecursiveOverride };
