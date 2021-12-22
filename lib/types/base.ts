import type { PackageJson } from 'type-fest';

export interface ModuleApi {
  displayName?: string;
  url?: string;
}

export type RenovatPackageJson = PackageJson & {
  'engines-next': Record<string, string>;
};
