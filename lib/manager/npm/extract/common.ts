// eslint-disable-next-line import/no-unresolved
import { PackageJson } from 'type-fest';

export type NpmPackageDependeny = PackageJson.Dependency;

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
