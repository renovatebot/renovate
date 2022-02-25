import type { PackageJson } from 'type-fest';

export interface ModuleApi {
  displayName?: string;
  url?: string;
}

export type RenovatePackageJson = PackageJson & {
  version: string;
  'engines-next': Record<string, string>;
  version: string;
};
