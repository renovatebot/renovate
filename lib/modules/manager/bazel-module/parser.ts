import { lang, query as q } from 'good-enough-parser';
import { logger } from '../../../logger';
import { Ctx } from './context';
import type { ValueFragment } from './fragments';
import { supportedRulesRegex } from './rules';

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
  .str((ctx, token) => {
    return Ctx.from(ctx).addString(token.value);
  });

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
      result = parsedResult.results;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Bazel parsing error');
  }

  return result;
}
