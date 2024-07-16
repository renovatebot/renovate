import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

const GlasskubePackageVersions = z.object({
  latestVersion: z.string(),
  versions: z.array(z.object({ version: z.string() })),
});

const GlasskubePackageManifest = z.object({
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
