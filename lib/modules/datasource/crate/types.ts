export type RegistryFlavor =
  /** https://crates.io, supports rawgit access */
  | 'crates.io'

  /** https://cloudsmith.io, needs git clone */
  | 'cloudsmith'

  /** unknown, assuming private git repository */
  | 'other';

export interface RegistryInfo {
  flavor: RegistryFlavor;

  /** raw URL of the registry, as specified in cargo config */
  rawUrl: string;

  /** parsed URL of the registry */
  url: URL;

  /** path where the registry is cloned */
  clonePath?: string;
}

export interface CrateRecord {
  vers: string;
  yanked: boolean;
}

export interface CrateMetadata {
  description: string | null;
  documentation: string | null;
  homepage: string | null;
  repository: string | null;
}
