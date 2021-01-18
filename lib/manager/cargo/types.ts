export interface CargoDep {
  /** Path on disk to the crate sources */
  path?: string;
  /** Git URL for the dependency */
  git?: string;
  /** Semver version */
  version?: string;
  /** Name of a registry whose URL is configured in `.cargo/config.toml` */
  registry?: string;
}

export type CargoDeps = Record<string, CargoDep | string>;

export interface CargoSection {
  dependencies?: CargoDeps;
  'dev-dependencies'?: CargoDeps;
  'build-dependencies'?: CargoDeps;
}

export interface CargoManifest extends CargoSection {
  target?: Record<string, CargoSection>;
}

export interface CargoConfig {
  registries?: Record<string, CargoRegistry>;
}

export interface CargoRegistry {
  index?: string;
}

export interface CargoRegistries {
  // maps registry names to URLs
  [key: string]: string;
}
