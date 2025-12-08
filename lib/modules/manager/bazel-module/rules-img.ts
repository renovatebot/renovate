import { z } from 'zod';
import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency } from '../types';
import { RepoRuleCallFragment, StringFragment } from './parser/fragments';

export const RulesImgPullCallToDep = RepoRuleCallFragment.extend({
  children: z.object({
    name: StringFragment,
    repository: StringFragment,
    registry: StringFragment.optional(),
    tag: StringFragment.optional(),
    digest: StringFragment.optional(),
  }),
}).transform(
  ({
    rawString,
    functionName,
    children: { name, repository, registry, tag, digest },
  }): PackageDependency => {
    // Note: Validation that this is a rules_img pull call is done in transformRulesImgCalls

    // Construct the package name
    let packageName = repository.value;
    if (registry?.value) {
      packageName = `${registry.value}/${repository.value}`;
    }

    const result: PackageDependency = {
      datasource: DockerDatasource.id,
      depType: 'rules_img_pull',
      depName: name.value,
      packageName,
      currentValue: tag?.value,
      currentDigest: digest?.value,
      replaceString: rawString,
    };
    if (registry?.value) {
      result.registryUrls = [`https://${registry.value}`];
    }

    return result;
  },
);

export function transformRulesImgCalls(fragments: any[]): PackageDependency[] {
  const deps: PackageDependency[] = [];

  // First, collect all use_repo_rule assignments to know which variables are repo rules
  const repoRuleVariables = new Map<
    string,
    { bzlFile: string; ruleName: string }
  >();

  for (const fragment of fragments) {
    if (fragment.type === 'useRepoRule') {
      repoRuleVariables.set(fragment.variableName, {
        bzlFile: fragment.bzlFile,
        ruleName: fragment.ruleName,
      });
    }
  }

  // Then process repo rule calls, but only for known repo rule variables
  for (const fragment of fragments) {
    if (fragment.type === 'repoRuleCall') {
      const functionName = fragment.functionName;

      // Only process if this function name corresponds to a known repo rule variable
      if (!repoRuleVariables.has(functionName)) {
        continue;
      }

      // Check if it's a rules_img repo rule
      const ruleInfo = repoRuleVariables.get(functionName);
      if (!ruleInfo?.bzlFile.includes('@rules_img//img:pull.bzl')) {
        continue;
      }

      try {
        const dep = RulesImgPullCallToDep.parse(fragment);
        deps.push(dep);
      } catch {
        // If parsing fails, it's not a rules_img pull call or is missing required fields
        continue;
      }
    }
  }

  return deps;
}
