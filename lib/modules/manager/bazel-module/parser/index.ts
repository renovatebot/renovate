import { lang, query as q } from 'good-enough-parser';
import { Ctx } from './context';
import { extensionTags } from './extension-tags';
import type { ResultFragment } from './fragments';
import {
  clearRepoRuleVariables,
  repoRuleCall,
  useRepoRuleAssignment,
} from './repo-rules';
import { rules } from './rules';

const rule = q.alt<Ctx>(
  rules,
  extensionTags,
  useRepoRuleAssignment,
  repoRuleCall,
);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

const starlarkLang = lang.createLang('starlark');

export function parse(input: string): ResultFragment[] {
  clearRepoRuleVariables();

  const parsedResult = starlarkLang.query(input, query, new Ctx(input));
  return parsedResult?.results ?? [];
}
