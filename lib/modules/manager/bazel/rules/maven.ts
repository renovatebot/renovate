import is from '@sindresorhus/is';
import { z } from 'zod';
import { MavenDatasource } from '../../../datasource/maven';
import { id as versioning } from '../../../versioning/gradle';
import type { PackageDependency } from '../../types';

export const mavenRules = ['maven_install', '_maven_install'] as const;

const ArtifactSpec = z.union([
  z.object({
    group: z.string(),
    artifact: z.string(),
    version: z.string(),
  }),
  z
    .object({
      '0': z.string(),
      '1': z.string(),
      '2': z.string(),
    })
    .transform((x) => ({ group: x[0], artifact: x[1], version: x[2] })),
]);
type ArtifactSpec = z.infer<typeof ArtifactSpec>;

export const MavenTarget = z
  .object({
    rule: z.enum(mavenRules),
    artifacts: z
      .union([z.string(), ArtifactSpec])
      .array()
      .transform((xs) => {
        const result: ArtifactSpec[] = [];
        for (const x of xs) {
          if (is.string(x)) {
            const [group, artifact, version] = x.split(':');
            if (group && artifact && version) {
              result.push({ group, artifact, version });
            }
          } else {
            result.push(x);
          }
        }

        return result;
      }),
    repositories: z.array(z.string()).optional(),
  })
  .transform(
    ({
      rule: depType,
      artifacts,
      repositories: registryUrls,
    }): PackageDependency[] =>
      artifacts.map(({ group, artifact, version: currentValue }) => ({
        datasource: MavenDatasource.id,
        versioning,
        depName: `${group}:${artifact}`,
        currentValue,
        depType,
        registryUrls,
      })),
  );
