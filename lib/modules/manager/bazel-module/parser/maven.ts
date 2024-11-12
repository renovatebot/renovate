import { query as q } from 'good-enough-parser';
import { z } from 'zod';
import { regEx } from '../../../../util/regex';
import { MavenDatasource } from '../../../datasource/maven';
import { id as versioning } from '../../../versioning/gradle';
import type { PackageDependency } from '../../types';
import type { Ctx } from '../context';
import {
  RecordFragmentSchema,
  StringArrayFragmentSchema,
  StringFragmentSchema,
} from '../fragments';
import { kvParams } from './common';

const artifactMethod = 'artifact';
const installMethod = 'install';
const commonDepType = 'maven_install';
const mavenVariableRegex = regEx(/^maven.*/);
const bzlmodMavenMethods = [installMethod, artifactMethod];
const methodRegex = regEx(`^${bzlmodMavenMethods.join('|')}$`);

function getParsedRuleByMethod(method: string): string {
  return `maven_${method}`;
}

const ArtifactSpec = z.object({
  group: z.string(),
  artifact: z.string(),
  version: z.string(),
});
type ArtifactSpec = z.infer<typeof ArtifactSpec>;

const MavenArtifactTarget = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.literal(getParsedRuleByMethod(artifactMethod)),
    }),
    artifact: StringFragmentSchema,
    group: StringFragmentSchema,
    version: StringFragmentSchema,
  }),
}).transform(
  ({ children: { rule, artifact, group, version } }): PackageDependency[] => [
    {
      datasource: MavenDatasource.id,
      versioning,
      depName: `${group.value}:${artifact.value}`,
      currentValue: version.value,
      depType: rule.value,
    },
  ],
);

const MavenInstallTarget = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.literal(getParsedRuleByMethod(installMethod)),
    }),
    artifacts: StringArrayFragmentSchema.transform((artifacts) => {
      const result: ArtifactSpec[] = [];
      for (const { value } of artifacts.items) {
        const [group, artifact, version] = value.split(':');
        if (group && artifact && version) {
          result.push({ group, artifact, version });
        }
      }

      return result;
    }),
    repositories: StringArrayFragmentSchema,
  }),
}).transform(
  ({ children: { rule, artifacts, repositories } }): PackageDependency[] =>
    artifacts.map(({ group, artifact, version: currentValue }) => ({
      datasource: MavenDatasource.id,
      versioning,
      depName: `${group}:${artifact}`,
      currentValue,
      depType: rule.value,
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
    if (dep.depType === getParsedRuleByMethod(installMethod)) {
      if (Array.isArray(dep.registryUrls)) {
        registryUrls.push(...dep.registryUrls);
        result.push(dep);
      }
    } else if (dep.depType === getParsedRuleByMethod(artifactMethod)) {
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

export const mavenRules = q
  .sym<Ctx>(mavenVariableRegex, (ctx, token) => {
    return ctx.startRule(token.value);
  })
  .op('.')
  .sym(methodRegex, (ctx, token) => {
    const rule = ctx.currentRecord.children.rule;
    if (rule.type === 'string') {
      rule.value = getParsedRuleByMethod(token.value);
    }
    return ctx;
  })
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx) => ctx.endRule(),
    }),
  );
