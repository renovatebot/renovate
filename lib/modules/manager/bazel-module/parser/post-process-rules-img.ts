import { regEx } from '../../../../util/regex';
import type { RepoRuleCallFragment, ResultFragment } from './fragments';
import * as fragments from './fragments';

/**
 * Post-process to extract rules_img dependencies.
 * This is done separately to avoid interfering with the main parser.
 */
export function extractRulesImgDependencies(input: string): ResultFragment[] {
  const results: RepoRuleCallFragment[] = [];

  // First, find all use_repo_rule assignments for rules_img
  const useRepoRuleRegex = regEx(
    /(\w+)\s*=\s*use_repo_rule\s*\(\s*["'](@rules_img[^"']*["'])\s*,\s*["'](\w+)["']\s*\)/g,
  );

  const repoRules = new Map<string, { rule: string; module: string }>();
  let match;

  while ((match = useRepoRuleRegex.exec(input)) !== null) {
    const [, varName, module, rule] = match;
    repoRules.set(varName, { rule, module: module.replace(/["']/g, '') });
  }

  if (repoRules.size === 0) {
    return [];
  }

  // Build regex to match repo rule calls
  const varNames = Array.from(repoRules.keys());
  const pullCallRegex = regEx(
    `(${varNames.join('|')})\\s*\\(([^)]+)\\)`,
    'gms',
  );

  while ((match = pullCallRegex.exec(input)) !== null) {
    const [fullMatch, functionName, paramsStr] = match;
    const ruleInfo = repoRules.get(functionName);

    if (!ruleInfo) {
      continue;
    }

    // Create a repo rule call fragment
    const fragment = fragments.repoRuleCall(
      ruleInfo.rule,
      functionName,
      ruleInfo.module,
    );

    // Extract parameters
    const paramRegex = regEx(/(\w+)\s*=\s*["']([^"']+)["']/g);
    let paramMatch;

    while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
      const [, key, value] = paramMatch;
      fragment.children[key] = fragments.string(value);
    }

    fragment.isComplete = true;
    fragment.rawString = fullMatch;
    results.push(fragment);
  }

  return results;
}
