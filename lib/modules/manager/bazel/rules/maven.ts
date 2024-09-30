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
    packaging: z.string().optional(),
    classifier: z.string().optional(),
  }),
  z
    .object({
      '0': z.string(),
      '1': z.string(),
      '2': z.string(),
      '3': z.string().optional(),
      '4': z.string().optional(),
    })
    .transform((x) => ({
      group: x[0],
      artifact: x[1],
      version: x[2],
      packaging: x[3],
      classifier: x[4],
    })),
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
            const parts = x.split(':');
            const [group, artifact, version] = parts;
            const packaging = parts.length === 5 ? parts[2] : undefined;
            const classifier = parts.length === 5 ? parts[3] : parts.length === 4 ? parts[2] : undefined;
            if (group && artifact && version) {
              result.push({ group, artifact, version, packaging, classifier });
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
      artifacts.map(({ group, artifact, version: currentValue, packaging, classifier }) => ({
        datasource: MavenDatasource.id,
        versioning,
        depName: `${group}:${artifact}`,
        currentValue,
        depType,
        registryUrls,
        managerData: {
          packaging,
          classifier,
        },
      })),
  );
