import { z } from 'zod';
import { MavenDatasource } from '../../../datasource/maven';
import { id as versioning } from '../../../versioning/gradle';
import type { PackageDependency } from '../../types';
import {
  ExtensionTagFragment,
  StringArrayFragment,
  StringFragment,
} from './fragments';

const artifactTag = 'artifact';
const installTag = 'install';
const commonDepType = 'maven_install';

export const mavenExtensionPrefix = 'maven';

export const mavenExtensionTags = [artifactTag, installTag];

function depTypeByTag(tag: string): string {
  return `maven_${tag}`;
}

const ArtifactSpec = z.object({
  group: z.string(),
  artifact: z.string(),
  version: z.string(),
});
type ArtifactSpec = z.infer<typeof ArtifactSpec>;

const MavenArtifactTarget = ExtensionTagFragment.extend({
  extension: z.literal(mavenExtensionPrefix),
  tag: z.literal(artifactTag),
  children: z.object({
    artifact: StringFragment,
    group: StringFragment,
    version: StringFragment,
  }),
}).transform(
  ({ children: { artifact, group, version } }): PackageDependency[] => [
    {
      datasource: MavenDatasource.id,
      versioning,
      depName: `${group.value}:${artifact.value}`,
      currentValue: version.value,
      depType: depTypeByTag(artifactTag),
    },
  ],
);

const MavenInstallTarget = ExtensionTagFragment.extend({
  extension: z.literal(mavenExtensionPrefix),
  tag: z.literal(installTag),
  children: z.object({
    artifacts: StringArrayFragment.transform((artifacts) => {
      const result: ArtifactSpec[] = [];
      for (const { value } of artifacts.items) {
        const [group, artifact, version] = value.split(':');
        if (group && artifact && version) {
          result.push({ group, artifact, version });
        }
      }

      return result;
    }),
    repositories: StringArrayFragment,
  }),
}).transform(({ children: { artifacts, repositories } }): PackageDependency[] =>
  artifacts.map(({ group, artifact, version: currentValue }) => ({
    datasource: MavenDatasource.id,
    versioning,
    depName: `${group}:${artifact}`,
    currentValue,
    depType: depTypeByTag(installTag),
    registryUrls: repositories.items.map((i) => i.value),
  })),
);

export const RuleToMavenPackageDep = z.union([
  MavenArtifactTarget,
  MavenInstallTarget,
]);

export function fillRegistryUrls(
  packageDeps: PackageDependency[][],
): PackageDependency[] {
  const artifactRules: PackageDependency[] = [];
  const registryUrls: string[] = [];
  const result: PackageDependency[] = [];

  // registry urls are specified only in maven.install, not in maven.artifact
  packageDeps.flat().forEach((dep) => {
    if (dep.depType === depTypeByTag(installTag)) {
      if (Array.isArray(dep.registryUrls)) {
        registryUrls.push(...dep.registryUrls);
        result.push(dep);
      }
    } else if (dep.depType === depTypeByTag(artifactTag)) {
      artifactRules.push(dep);
    }
  });

  const uniqUrls = [...new Set(registryUrls)];

  for (const artifactRule of artifactRules) {
    artifactRule.registryUrls = uniqUrls;
    artifactRule.depType = commonDepType;
    result.push(artifactRule);
  }

  return result;
}
