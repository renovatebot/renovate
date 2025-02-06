import { lang, query as q } from 'good-enough-parser';
import { Ctx } from '../context';
import type { RecordFragment } from '../fragments';
import { mavenRules } from './maven';
import { moduleRules } from './module';
import { ociRules } from './oci';

const rule = q.alt<Ctx>(moduleRules, mavenRules, ociRules);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

const starlarkLang = lang.createLang('starlark');

export function parse(input: string): RecordFragment[] {
  const parsedResult = starlarkLang.query(input, query, new Ctx());
  return parsedResult?.results ?? [];
}
