import { z } from 'zod';

export type GalaxyV3 = z.infer<typeof GalaxyV3>;
export const GalaxyV3 = z.object({
  deprecated: z.boolean(),
  highest_version: z.object({
    version: z.string(),
  }),
});

export type GalaxyV3Versions = z.infer<typeof GalaxyV3Versions>;
export const GalaxyV3Versions = z
  .object({
    data: z.array(
      z.object({
        version: z.string(),
        created_at: z.string().datetime(),
      }),
    ),
  })
  .transform(({ data }) => {
    return data.map((value) => {
      return {
        version: value.version,
        releaseTimestamp: value.created_at,
      };
    });
  });

export type GalaxyV3DetailedVersion = z.infer<typeof GalaxyV3DetailedVersion>;
export const GalaxyV3DetailedVersion = z
  .object({
    version: z.string(),
    download_url: z.string(),
    artifact: z.object({
      sha256: z.string(),
    }),
    metadata: z.object({
      homepage: z.string(),
      repository: z.string(),
      dependencies: z.record(z.string(), z.string()).optional(),
    }),
  })
  .transform((value) => {
    return {
      version: value.version,
      downloadUrl: value.download_url,
      newDigest: value.artifact.sha256,
      dependencies: value.metadata.dependencies,
      sourceUrl: value.metadata.repository,
    };
  });
