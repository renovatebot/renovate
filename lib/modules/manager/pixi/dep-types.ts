import type { DepTypeMetadata } from '../types.ts';

/**
 * pixi depTypes are fully dynamic: feature dependencies produce
 * `feature-${name}` depTypes at runtime, where `name` is the
 * feature name defined in the pixi configuration.
 *
 * Top-level dependencies (under `[dependencies]` or `[pypi-dependencies]`)
 * do not have a depType set.
 *
 * There are no fixed/enumerable depType values for this manager.
 */
export const knownDepTypes = [] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Feature dependencies produce dynamic `depType` values in the form `feature-<name>`, where `<name>` is the feature name defined in the pixi configuration. Top-level dependencies (under `[dependencies]` or `[pypi-dependencies]`) do not have a `depType` set.';
