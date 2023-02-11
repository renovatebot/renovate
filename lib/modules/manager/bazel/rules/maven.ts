import is from '@sindresorhus/is';
import { z } from 'zod';
import { MavenDatasource } from '../../../datasource/maven';
import type { PackageDependency } from '../../types';

export const mavenRules = ['maven_install'] as const;

const ArtifactSpec = z.object({
  group: z.string(),
  artifact: z.string(),
  version: z.string(),
});
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
  .transform(({ rule, artifacts, repositories }): PackageDependency[] =>
    artifacts.map((artifact) => ({
      datasource: MavenDatasource.id,
      depType: rule,
      packageName: `${artifact.group}:${artifact.artifact}`,
      currentValue: artifact.version,
      registryUrls: repositories,
    }))
  );
