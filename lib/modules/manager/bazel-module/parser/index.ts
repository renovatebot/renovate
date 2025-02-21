import { lang, query as q } from 'good-enough-parser';
import { Ctx } from './context';
import { extensionTags } from './extension-tags';
import type { ResultFragment } from './fragments';
import { rules } from './rules';

const rule = q.alt<Ctx>(rules, extensionTags);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

const starlarkLang = lang.createLang('starlark');

export function parse(input: string): ResultFragment[] {
  const parsedResult = starlarkLang.query(input, query, new Ctx(input));
  return parsedResult?.results ?? [];
}
