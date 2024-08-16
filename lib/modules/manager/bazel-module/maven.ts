import { z } from 'zod';
import { MavenDatasource } from '../../datasource/maven';
import { id as versioning } from '../../versioning/gradle';
import type { PackageDependency } from '../types';

export const mavenVariableRegex = /maven.*/;
export const bzlmodMavenMethods = ['install', 'artifact'];
export function getParsedRuleByMethod(method: string): string {
  return `maven_${method}`;
}

// TODO: the same type as lib/modules/manager/bazel/rules/maven.ts
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

// export const MavenArtifactTarget = z
//   .object({
//     rule: z.enum([artifactRule]),
//     artifact: z.string(),
//     group: z.string(),
//     version: z.string(),
//   })
//   .transform(
//     ({ rule: depType, artifact, group, version }): PackageDependency => ({
//       datasource: MavenDatasource.id,
//       versioning,
//       depName: `${group}:${artifact}`,
//       currentValue: version,
//       depType,
//     }),
//   );

// export const MavenInstallTarget = z
//   .object({
//     rule: z.enum([installRule]),
//     artifacts: z
//       .string()
//       .array()
//       .transform((xs) => {
//         const result: ArtifactSpec[] = [];
//         for (const x of xs) {
//           const [group, artifact, version] = x.split(':');
//           if (group && artifact && version) {
//             result.push({ group, artifact, version });
//           }
//         }

//         return result;
//       }),
//     repositories: z.array(z.string()).optional(),
//   })
//   .transform(
//     ({
//       rule: depType,
//       artifacts,
//       repositories: registryUrls,
//     }): PackageDependency[] =>
//       artifacts.map(({ group, artifact, version: currentValue }) => ({
//         datasource: MavenDatasource.id,
//         versioning,
//         depName: `${group}:${artifact}`,
//         currentValue,
//         depType,
//         registryUrls,
//       })),
//   );
