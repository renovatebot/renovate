import { lang, query as q } from 'good-enough-parser';
import { regEx } from '../../../util/regex';
import { Ctx } from './context';
import type { RecordFragment } from './fragments';
import { mavenRules } from './maven';
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
 * - `name = True`
 * - `name = ["foo", "bar"]`
 **/
const kvParams = q
  .sym<Ctx>((ctx, token) => ctx.startAttribute(token.value))
  .op('=')
  .alt(
    q.str((ctx, token) => ctx.addString(token.value)),
    q.sym<Ctx>(booleanValuesRegex, (ctx, token) => ctx.addBoolean(token.value)),
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '[',
      endsWith: ']',
      postHandler: (ctx) => ctx.endArray(),
      preHandler: (ctx) => ctx.startArray(),
      search: q.many(q.str<Ctx>((ctx, token) => ctx.addString(token.value))),
    }),
  );

const moduleRules = q
  .alt<Ctx>(
    mavenRules,
    q.sym(supportedRulesRegex, (ctx, token) => {
      // TODO in separate parser

      return ctx.startRule(token.value);
    }),
  )
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx) => ctx.endRule(),
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


