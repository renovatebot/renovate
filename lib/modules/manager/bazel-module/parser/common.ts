import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../context';
import * as starlark from '../starlark';

const booleanValuesRegex = regEx(`^${starlark.booleanStringValues.join('|')}$`);

/**
 * Matches key-value pairs:
 * - `name = "foobar"`
 * - `name = True`
 * - `name = ["string"]`
 **/
export const kvParams = q
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
