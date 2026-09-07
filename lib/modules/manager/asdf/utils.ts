import { isFunction } from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';
import type {
  JavaDistribution,
  StaticTooling,
  ToolingConfig,
} from './types.ts';

/**
 * Resolve a tooling definition into a static config. The definition may hold
 * either a static config or a function of the currently configured version.
 * Shared by the `asdf` and `mise` extractors.
 */
export function resolveToolingConfig(
  definition: { config: ToolingConfig } | undefined,
  version: string,
): StaticTooling | null {
  if (!definition) {
    return null;
  }
  const { config } = definition;
  return (isFunction(config) ? config(version) : config) ?? null;
}

/**
 * Match a java version such as `temurin-jre-21.0.1` against an ordered list of
 * distribution prefixes, returning the package name and the bare version.
 */
export function matchJavaDistribution(
  version: string,
  distributions: readonly JavaDistribution[],
): { packageName: string; currentValue: string } | undefined {
  for (const { prefix, packageName } of distributions) {
    const currentValue = regEx(`^${prefix}(?<version>\\d\\S+)`).exec(version)
      ?.groups?.version;
    if (currentValue) {
      return { packageName, currentValue };
    }
  }
  return undefined;
}
