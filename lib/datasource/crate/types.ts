// eslint-disable-next-line typescript-enum/no-enum
export enum RegistryFlavor {
  /** https://crates.io, supports rawgit access */
  CratesIo,

  /** https://cloudsmith.io, needs git clone */
  Cloudsmith,

  /** unknown, assuming private git repository */
  Other,
}

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
