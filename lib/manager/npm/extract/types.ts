import type { PackageJson } from 'type-fest';

export type NpmPackageDependency = PackageJson.Dependency;

export interface NpmPackage extends PackageJson {
  renovate?: unknown;
  _from?: any;
  _args?: any;
  _id?: any;
}

export type LockFileEntry = Record<
  string,
  { version: string; integrity?: boolean }
>;

export interface LockFile {
  lockedVersions: Record<string, string>;
  lockfileVersion?: number; // cache version for Yarn
  isYarn1?: boolean;
}
