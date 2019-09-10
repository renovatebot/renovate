export type EsyDeps = Record<string, string>;

export interface EsySection {
  dependencies: EsyDeps;
  devDependencies: EsyDeps;
  buildDependencies: EsyDeps;
}
