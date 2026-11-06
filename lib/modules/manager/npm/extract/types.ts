import type { DateTime } from 'luxon';
import type { PackageJson } from 'type-fest';

export type NpmPackageDependency = PackageJson.Dependency;
export type DependenciesMeta = Record<
  string,
  { optional: boolean; built: boolean; unplugged: boolean }
>;

// https://docs.npmjs.com/cli/v11/configuring-npm/package-json#devengines
interface DevEngineItem {
  name: string;
  version?: string;
  onFail?: 'warn' | 'error' | 'ignore';
}

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
  devEngines?: {
    runtime?: DevEngineItem | DevEngineItem[];
    packageManager?: DevEngineItem | DevEngineItem[];
  };
};

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
  minimumReleaseAge?: number;
  minimumReleaseAgeExclude?: string[];
}

/**
 * A pnpm catalog is either the default catalog (catalog:, catalogs:default), or
 * a named one (catalogs:<name>)
 */
export interface Catalog {
  name: string;
  dependencies: NpmPackageDependency;
}

export type OverrideDependency = Record<string, RecursiveOverride>;

export type RecursiveOverride = string | { [_: string]: RecursiveOverride };

/** the cooldown which npm applies for the `before` or `min-release-age` setting of an `.npmrc` */
export type NpmrcCooldown =
  | { source: 'before'; date: DateTime<true> }
  | { source: 'min-release-age'; days: number };

/**
 * The settings of a pnpm lock file which decide whether pnpm enforces the minimum release age, from its `pnpm-workspace.yaml` and its root `package.json`, with the ages in minutes.
 */
export interface PnpmManagerDataMinimumReleaseAge {
  minimumReleaseAge?: number;
  minimumReleaseAgeStrict?: boolean;
  /** whether `minimumReleaseAgeExclude` lets pnpm install versions of some packages which are too new */
  hasMinimumReleaseAgeExclude?: boolean;
  /** the pnpm constraint from the `constraints` config, the root `package.json` or the `lockfileVersion` of the lock file */
  pnpmConstraint?: string;
  /** the `minimum-release-age` of the `.npmrc` of the root `package.json`, which pnpm reads before v11 */
  npmrcMinimumReleaseAge?: number;
}

/**
 * The `minimumReleaseAgeExclude` entries of a `pnpm-workspace.yaml`, with the package names as `matchPackageNames` patterns.
 */
export interface PnpmMinimumReleaseAgeExclude {
  /** One pattern per entry which excludes every version of the packages it matches */
  packageNames: string[];
  /** The entries which exclude only some versions of a package */
  versions: { packageName: string; versions: string[] }[];
}

/**
 * The `npmMinimalAgeGate` settings of a `.yarnrc.yml` in minutes.
 */
export interface YarnMinimalAgeGateSettings {
  npmMinimalAgeGate?: number;
  /** The `npmMinimalAgeGate` of each scope of `npmScopes`, keyed by the scope without `@`, or `null` for a scope without one */
  npmScopes?: Record<string, number | null>;
}

/**
 * The minimum release age settings of a Yarn lock file which Renovate keeps in `managerData`, from its `.yarnrc.yml` and its root `package.json`, with the ages in minutes.
 */
export interface YarnManagerDataMinimalAgeGate extends YarnMinimalAgeGateSettings {
  /** Whether `npmPreapprovedPackages` has entries, which Yarn installs without a minimum release age */
  hasNpmPreapprovedPackages?: boolean;
  /** The Yarn constraint of the root `package.json` of the lock file */
  yarnConstraint?: string;
}

/**
 * The minimum release age settings of a `.yarnrc.yml`, with the ages in minutes.
 */
export interface YarnrcMinimalAgeGateSettings extends YarnMinimalAgeGateSettings {
  npmPreapprovedPackages?: string[];
}

/**
 * An `npmPreapprovedPackages` entry, with the package name or glob and an optional semver range.
 */
export interface YarnPreapprovedPackage {
  packageName: string;
  range?: string;
}

/**
 * The package files of a lock file.
 */
export interface LockFilePackageFiles<T> {
  lockFile: string;
  packageFiles: T[];
  /** The `package.json` next to the lock file, else the first `package.json` of the lock file */
  root: T | undefined;
}
