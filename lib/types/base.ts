import type { PackageJson } from 'type-fest';

export interface ModuleApi {
  displayName?: string;
  url?: string;

  /** optional URLs to add to docs as references */
  urls?: string[];
}

export type RenovatePackageJson = PackageJson & {
  'engines-next': Record<string, string>;
  version: string;
};
