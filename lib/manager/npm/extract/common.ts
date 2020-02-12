import { PackageJson } from 'type-fest';

export interface NpmPackage extends PackageJson {
  workspaces?: any;
  renovate?: any;
  _from?: any;
  _args?: any;
  _id?: any;
}

export type LockFileEntry = Record<
  string,
  { version: string; integrity?: boolean }
>;
