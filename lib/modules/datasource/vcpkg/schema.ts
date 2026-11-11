import { isString } from '@sindresorhus/is';
import { z } from 'zod/v4';

const VcpkgPortVersionEntry = z
  .object({
    'git-tree': z.string(),
    'port-version': z.number().int().nonnegative().optional(),
    version: z.string().optional(),
    'version-semver': z.string().optional(),
    'version-date': z.string().optional(),
    'version-string': z.string().optional(),
  })
  .refine(
    (entry) =>
      isString(
        entry.version ??
          entry['version-semver'] ??
          entry['version-date'] ??
          entry['version-string'],
      ),
    {
      error:
        'one of version, version-semver, version-date, version-string is required',
    },
  );

export const VcpkgPortVersions = z.object({
  versions: z.array(VcpkgPortVersionEntry).min(1),
});

export type VcpkgPortVersions = z.infer<typeof VcpkgPortVersions>;
