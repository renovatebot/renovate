export interface CargoDep {
  path: any;
  git: any;
  version: any;
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
