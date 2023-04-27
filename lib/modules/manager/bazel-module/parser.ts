import { lang, query as q } from 'good-enough-parser';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { Ctx } from './context';
import type { ValueFragment } from './fragments';
import { StarlarkBoolean } from './starlark';

const booleanValuesRegex = regEx(`^${StarlarkBoolean.stringValues.join('|')}$`);
const supportedRules = ['bazel_dep'];
const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

/**
 * Matches key-value pairs:
 * - `tag = "1.2.3"`
 * - `name = "foobar"`
 * - `deps = ["foo", "bar"]`
 * - `
 *     artifacts = [
         maven.artifact(
           group = "com.example1",
           artifact = "foobar",
           version = "1.2.3",
         )
       ]
     `
 **/
const kwParams = q
  .sym<Ctx>((ctx, token) => {
    return Ctx.from(ctx).startAttribute(token.value);
  })
  .op('=')
  .alt(
    q.str((ctx, token) => {
      return Ctx.from(ctx).addString(token.value);
    }),
    q.sym<Ctx>(booleanValuesRegex, (ctx, token) => {
      return Ctx.from(ctx).addBoolean(token.value);
    })
  );

const moduleRules = q
  .sym<Ctx>(supportedRulesRegex, (ctx, token) => {
    return Ctx.from(ctx).startRule(token.value);
  })
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kwParams,
      postHandler: (ctx, tree) => {
        return Ctx.from(ctx).endRule();
      },
    })
  );

const rule = q.alt<Ctx>(moduleRules);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

const starlark = lang.createLang('starlark');

export function parse(
  input: string,
  packageFile?: string
): ValueFragment[] | null {
  // TODO: Add the mem cache.

  let result: ValueFragment[] | null = null;
  try {
    const parsedResult = starlark.query(input, query, new Ctx());
    if (parsedResult) {
      // The parsedResult and its associated objects are missing their types.
      result = Ctx.from(parsedResult).results;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Bazel module parsing error');
  }

  return result;
}
