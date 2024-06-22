import { z } from 'zod';
import { Json, LooseRecord } from '../../../util/schema-utils';

export const PackageManagerSchema = z
  .string()
  .transform((val) => val.split('@'))
  .transform(([name, ...version]) => ({ name, version: version.join('@') }));

export const PackageJsonSchema = z.object({
  engines: LooseRecord(z.string()).optional(),
  dependencies: LooseRecord(z.string()).optional(),
  devDependencies: LooseRecord(z.string()).optional(),
  peerDependencies: LooseRecord(z.string()).optional(),
  packageManager: PackageManagerSchema.optional(),
});

export type PackageJsonSchema = z.infer<typeof PackageJsonSchema>;

export const PackageJson = Json.pipe(PackageJsonSchema);

export const PackageLockV3Schema = z.object({
  lockfileVersion: z.literal(3),
  packages: LooseRecord(
    z
      .string()
      .transform((x) => x.replace(/^node_modules\//, ''))
      .refine((x) => x.trim() !== ''),
    z.object({ version: z.string() }),
  ),
});

export const PackageLockPreV3Schema = z
  .object({
    lockfileVersion: z.union([z.literal(2), z.literal(1)]),
    dependencies: LooseRecord(z.object({ version: z.string() })),
  })
  .transform(({ lockfileVersion, dependencies: packages }) => ({
    lockfileVersion,
    packages,
  }));

export const PackageLock = Json.pipe(
  z.union([PackageLockV3Schema, PackageLockPreV3Schema]),
).transform(({ packages, lockfileVersion }) => {
  const lockedVersions: Record<string, string> = {};
  for (const [entry, val] of Object.entries(packages)) {
    lockedVersions[entry] = val.version;
  }
  return { lockedVersions, lockfileVersion };
});
