import { lang, query as q } from 'good-enough-parser';
import { Ctx } from '../context';
import type { ResultFragment } from '../fragments';
import { extensionTags } from './extension-tags';
import { rules } from './rules';

const rule = q.alt<Ctx>(rules, extensionTags);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

const starlarkLang = lang.createLang('starlark');

export function parse(input: string): ResultFragment[] {
  const parsedResult = starlarkLang.query(input, query, new Ctx());
  return parsedResult?.results ?? [];
}
