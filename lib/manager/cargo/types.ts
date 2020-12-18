export interface CargoDep {
  path: any;
  git: any;
  version: any;
  registry: any;
}

export type CargoDeps = Record<string, CargoDep | string>;

export interface CargoSection {
  dependencies: CargoDeps;
  'dev-dependencies': CargoDeps;
  'build-dependencies': CargoDeps;
}

export interface CargoConfig extends CargoSection {
  target: Record<string, CargoSection>;
}

export interface CargoConfig {
  registries?: Record<string, CargoRegistry>;
}

export interface CargoRegistry {
  index?: string;
}

export interface CargoRegistries {
  // maps registry names to URLs
  map?: Record<string, string>;
}
