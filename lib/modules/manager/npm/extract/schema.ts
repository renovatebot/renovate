import { z } from 'zod';

/**
 * Removes the entry with an empty key which is used
 * in packagelock v3 to indicate a root package.
 */
const removeRecordsWithEmptyKeys = (value: any): any =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => {
      return key.trim() !== '';
    })
  );

/**
 * Package names in package-lock v3 are prefixed with `node_modules/`.
 * This function removes that prefix to extract only the package name.
 */
const removeNodeModulesPrefix = (packageName: string): string =>
  packageName.replace(/^node_modules\//, '');

export const PackageLockV3Schema = z.object({
  lockfileVersion: z.literal(3),
  packages: LooseRecord(
    z
      .string()
      .transform((x) => x.replace(/^node_modules\//, ''))
      .refine((x) => x.trim() !== ''),
    z.object({ version: z.string() })
  ),
});

export const PackageLockPreV3Schema = z.object({
  lockfileVersion: z.union([z.literal(2), z.literal(1)]),
  dependencies: z
    .record(z.string(), z.object({ version: z.string() }))
    .catch({}),
});
