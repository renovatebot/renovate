import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export const GlasskubePackageVersions = z.object({
  latestVersion: z.string(),
  versions: z.array(z.object({ version: z.string() })),
});

export const GlasskubePackageManifest = z.object({
  references: z.optional(
    z.array(
      z.object({
        label: z.string(),
        url: z.string(),
      }),
    ),
  ),
});

export const GlasskubePackageVersionsYaml = Yaml.pipe(GlasskubePackageVersions);
export const GlasskubePackageManifestYaml = Yaml.pipe(GlasskubePackageManifest);

export type GlasskubePackageVersions = z.infer<typeof GlasskubePackageVersions>;
export type GlasskubePackageManifest = z.infer<typeof GlasskubePackageManifest>;
