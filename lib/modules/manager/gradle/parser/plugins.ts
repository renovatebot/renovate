import { query as q } from '@renovatebot/good-enough-parser';
import { regEx } from '../../../../util/regex.ts';
import type { Ctx } from '../types.ts';
import {
  cleanupTempVars,
  qStringValue,
  qValueMatcher,
  qVersion,
  storeInTokenMap,
  storeVarToken,
} from './common.ts';
import { handlePlugin } from './handlers.ts';

export const qPlugins = q
  .sym(regEx(/^(?:id|kotlin)$/), storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  .alt(
    // id "foo.bar" version "1.2.3"
    qStringValue
      .handler((ctx: Ctx) => storeInTokenMap(ctx, 'pluginName'))
      .sym('version')
      .join(qVersion),
    // kotlin("jvm") version "1.3.71"
    q
      .tree({
        type: 'wrapped-tree',
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search: q.begin<Ctx>().join(qValueMatcher).end(),
      })
      .handler((ctx) => storeInTokenMap(ctx, 'pluginName'))
      .alt(
        // id("foo.bar") version "1.2.3"
        q.sym<Ctx>('version').join(qVersion),
        // id("foo.bar").version("1.2.3")
        // id("foo.bar") version("1.2.3")
        q
          .opt(q.op<Ctx>('.'))
          .sym('version')
          .tree({
            maxDepth: 1,
            startsWith: '(',
            endsWith: ')',
            search: q.begin<Ctx>().join(qVersion).end(),
          }),
      ),
  )
  .handler(handlePlugin)
  .handler(cleanupTempVars);
