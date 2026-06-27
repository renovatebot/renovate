import { z } from 'zod/v3';

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
      typeof (
        entry.version ??
        entry['version-semver'] ??
        entry['version-date'] ??
        entry['version-string']
      ) === 'string',
    {
      message:
        'one of version, version-semver, version-date, version-string is required',
    },
  );

export const VcpkgPortVersions = z.object({
  versions: z.array(VcpkgPortVersionEntry).min(1),
});

export type VcpkgPortVersions = z.infer<typeof VcpkgPortVersions>;

export const VcpkgBaseline = z.object({
  default: z.record(
    z.object({
      baseline: z.string(),
      'port-version': z.number().int().nonnegative(),
    }),
  ),
});

export type VcpkgBaseline = z.infer<typeof VcpkgBaseline>;
