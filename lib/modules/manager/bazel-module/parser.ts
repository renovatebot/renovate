import { lang, query as q } from 'good-enough-parser';
import { regEx } from '../../../util/regex';
import { Ctx } from './context';
import type { ValueFragment } from './fragments';
import * as starlark from './starlark';

const booleanValuesRegex = regEx(`^${starlark.booleanStringValues.join('|')}$`);
const supportedRules = ['bazel_dep'];
const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

/**
 * Matches key-value pairs:
 * - `name = "foobar"`
 * - `dev_dependeny = True`
 **/
const kvParams = q
  .sym<Ctx>((ctx, token) => {
    return Ctx.as(ctx).startAttribute(token.value);
  })
  .op('=')
  .alt(
    q.str((ctx, token) => {
      return Ctx.as(ctx).addString(token.value);
    }),
    q.sym<Ctx>(booleanValuesRegex, (ctx, token) => {
      return Ctx.as(ctx).addBoolean(token.value);
    })
  );

const moduleRules = q
  .sym<Ctx>(supportedRulesRegex, (ctx, token) => {
    return Ctx.as(ctx).startRule(token.value);
  })
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx, tree) => {
        return Ctx.as(ctx).endRule();
      },
    })
  );

const rule = q.alt<Ctx>(moduleRules);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

const starlarkLang = lang.createLang('starlark');

export function parse(input: string): ValueFragment[] {
  const parsedResult = starlarkLang.query(input, query, new Ctx());
  if (parsedResult) {
    return parsedResult.results;
  }
  return [];
}
