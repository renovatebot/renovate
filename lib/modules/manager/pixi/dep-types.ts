import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Feature dependencies produce dynamic `depType` values in the form `feature-<name>`, where `<name>` is the feature name defined in the pixi configuration. Top-level dependencies (under `[dependencies]` or `[pypi-dependencies]`) do not have a `depType` set.';
