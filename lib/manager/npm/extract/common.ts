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
