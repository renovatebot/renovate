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
  pnpm?: {
    overrides?: PackageJson.Dependency;
  };
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
  lockedVersionsWithCatalog?: Record<string, Record<string, string>>;
  lockfileVersion?: number; // cache version for Yarn
  isYarn1?: boolean;
}

export interface PnpmWorkspaceFile {
  packages: string[];
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

/**
 * A pnpm catalog is either the default catalog (catalog:, catalogs:default), or
 * a named one (catalogs:<name>)
 */
export interface PnpmCatalog {
  name: string;
  dependencies: NpmPackageDependency;
}

export type OverrideDependency = Record<string, RecursiveOverride>;

export type RecursiveOverride = string | { [_: string]: RecursiveOverride };
