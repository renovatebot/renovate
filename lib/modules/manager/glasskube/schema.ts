import { z } from 'zod';

export const Package = z.object({
  apiVersion: z.string().startsWith('packages.glasskube.dev/'),
  kind: z.literal('Package').or(z.literal('ClusterPackage')),
  spec: z.object({
    packageInfo: z.object({
      name: z.string(),
      version: z.string(),
      repositoryName: z.string().optional(),
    }),
  }),
});

export const PackageRepository = z.object({
  apiVersion: z.string().startsWith('packages.glasskube.dev/'),
  kind: z.literal('PackageRepository'),
  metadata: z.object({
    name: z.string(),
    annotations: z.record(z.string(), z.string()).optional(),
  }),
  spec: z.object({
    url: z.string(),
  }),
});

export const GlasskubeResource = Package.or(PackageRepository);

export type Package = z.infer<typeof Package>;
export type PackageRepository = z.infer<typeof PackageRepository>;
export type GlasskubeResource = z.infer<typeof GlasskubeResource>;
