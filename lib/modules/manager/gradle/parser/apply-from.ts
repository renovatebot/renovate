import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import { cleanupTempVars, qValueMatcher, storeInTokenMap } from './common';
import { handleApplyFrom } from './handlers';

// apply from: 'foo.gradle'
// apply(from = property("foo"))
const qApplyFromFile = q
  .alt(
    q
      .alt(
        q
          .opt(q.sym<Ctx>(regEx(/^(?:rootProject|project)$/)).op('.'))
          .sym('file'),
        q.opt<Ctx>(q.sym('new')).sym('File'),
      )
      .tree({
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search: q
          .begin<Ctx>()
          .opt(
            q
              .join(qValueMatcher, q.op(','))
              .handler((ctx) => storeInTokenMap(ctx, 'parentPath')),
          )
          .join(qValueMatcher)
          .end(),
      }),
    qValueMatcher,
  )
  .handler((ctx) => storeInTokenMap(ctx, 'scriptFile'));

export const qApplyFrom = q
  .sym<Ctx>('apply')
  .alt(
    q // apply from: rootProject.file("basedir", "foo/bar.gradle")
      .sym<Ctx>('from')
      .op(':')
      .join(qApplyFromFile),
    q // apply(from = File(base, "bar.gradle"))
      .tree({
        maxDepth: 1,
        maxMatches: 1,
        startsWith: '(',
        endsWith: ')',
        search: q.begin<Ctx>().sym('from').op('=').join(qApplyFromFile).end(),
      }),
  )
  .handler(handleApplyFrom)
  .handler(cleanupTempVars);
