import { lang, query as q } from 'good-enough-parser';
import { regEx } from '../../../util/regex';
import { Ctx } from './context';
import type { RecordFragment } from './fragments';
import * as starlark from './starlark';

const booleanValuesRegex = regEx(`^${starlark.booleanStringValues.join('|')}$`);
const supportedRules = [
  'archive_override',
  'bazel_dep',
  'git_override',
  'local_path_override',
  'single_version_override',
];
const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

/**
 * Matches key-value pairs:
 * - `name = "foobar"`
 **/
const kvParams = q
  .sym<Ctx>((ctx, token) => ctx.startAttribute(token.value))
  .op('=')
  .alt(
    q.str((ctx, token) => ctx.addString(token.value)),
    q.sym<Ctx>(booleanValuesRegex, (ctx, token) => ctx.addBoolean(token.value)),
  );

const moduleRules = q
  .sym<Ctx>(supportedRulesRegex, (ctx, token) => ctx.startRule(token.value))
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx, tree) => ctx.endRule(),
    }),
  );

const rule = q.alt<Ctx>(moduleRules);

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
