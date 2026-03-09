import { z } from 'zod/v4';
import { getOptions } from '../../config/options/index.ts';
import { isVersioningApiConstructor } from './common.ts';
import * as allVersioning from './index.ts';
import * as semverCoercedVersioning from './semver-coerced/index.ts';

describe('modules/versioning/index', () => {
  it('should fallback to semver-coerced', () => {
    const semverCoerced = allVersioning.get(semverCoercedVersioning.id);
    expect(allVersioning.get(undefined)).toBe(semverCoerced);
    expect(allVersioning.get('unknown')).toBe(semverCoerced);
  });

  it('should accept config', () => {
    expect(allVersioning.get('semver:test')).toBeDefined();
  });

  it('matches the API contract', async () => {
    const versionings = allVersioning.getVersionings();

    const VersioningApiSchema = z
      .string()
      .refine((name) => versionings.has(name), {
        error: 'Allowed in config but does not exist in the API',
      })
      .transform(async (name) => {
        const { api } = await import(`./${name}/index.ts`);
        return isVersioningApiConstructor(api) ? new api() : api;
      })
      .pipe(
        z.object({
          isValid: z.function(),
          isVersion: z.function(),
          isSingleVersion: z.function(),
          isStable: z.function(),
          isCompatible: z.function(),
          equals: z.function(),
          isGreaterThan: z.function(),
          getMajor: z.function(),
          getMinor: z.function(),
          getPatch: z.function(),
          getSatisfyingVersion: z.function(),
          minSatisfyingVersion: z.function(),
          getNewValue: z.function(),
          sortVersions: z.function(),
          matches: z.function(),
          isBreaking: z.function().optional(),
          isLessThanRange: z.function().optional(),
          valueToVersion: z.function().optional(),
          subset: z.function().optional(),
          intersects: z.function().optional(),
          allowUnstableMajorUpgrades: z.boolean().optional(),
          isSame: z.function().optional(),
          getPinnedValue: z.function().optional(),
        }),
      );

    const config = getOptions().find(({ name }) => name === 'versioning');

    const ValidVersioningSchema = z
      .object({ allowedValues: z.string().array() })
      .transform(({ allowedValues }) => allowedValues)
      .pipe(VersioningApiSchema.array());

    await expect(
      ValidVersioningSchema.parseAsync(config),
    ).resolves.toBeDefined();
  });
});
