import { isString } from '@sindresorhus/is';
import { z } from 'zod/v4';
import { Json } from '../../../util/schema-utils/index.ts';

const DependencyEntry = z.union([
  z.string(),
  z.object({
    name: z.string(),
    'version>=': z.string().optional(),
  }),
]);

const overrideVersionFields = [
  'version',
  'version-semver',
  'version-date',
  'version-string',
] as const;

/**
 * Returns the field in which an override names its upstream version: the
 * first of `version`, `version-semver`, `version-date` and `version-string`
 * that holds a non-empty string.
 */
export function findOverrideVersionField(
  entry: Record<string, unknown>,
): (typeof overrideVersionFields)[number] | undefined {
  return overrideVersionFields.find(
    (field) => isString(entry[field]) && entry[field] !== '',
  );
}

const OverrideEntry = z.object({
  name: z.string(),
  version: z.string().optional(),
  'version-semver': z.string().optional(),
  'version-date': z.string().optional(),
  'version-string': z.string().optional(),
  'port-version': z.number().int().nonnegative().optional(),
});

export const VcpkgManifest = Json.pipe(
  z.object({
    version: z.string().optional(),
    'version-semver': z.string().optional(),
    'version-date': z.string().optional(),
    'version-string': z.string().optional(),
    dependencies: z.array(DependencyEntry).optional(),
    overrides: z.array(OverrideEntry).optional(),
  }),
);
