import { lang, query as q } from '@renovatebot/good-enough-parser';
import { coerceArray } from '../../../../util/array.ts';
import { Ctx } from './context.ts';
import { extensionTags } from './extension-tags.ts';
import {
  clearRepoRuleVariables,
  repoRuleCall,
  useRepoRuleAssignment,
} from './repo-rules.ts';
import { rules } from './rules.ts';
import type { ResultFragment } from './types.ts';

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
  return coerceArray(parsedResult?.results);
}
