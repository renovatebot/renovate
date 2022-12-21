import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import {
  cleanupTempVars,
  qPropertyAccessIdentifier,
  qTemplateString,
  qVariableAccessIdentifier,
  storeInTokenMap,
} from './common';
import { handleApplyFrom } from './handlers';

const qApplyFromFile = q
  .alt(
    qTemplateString, // apply from: 'foo.gradle'
    qPropertyAccessIdentifier, // apply(from = property("foo"))
    q
      .alt(
        q
          .opt(q.sym<Ctx>(regEx(/^(?:rootProject|project)$/)).op('.'))
          .sym('file'),
        q.opt<Ctx>(q.sym('new')).sym('File')
      )
      .tree({
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search: q
          .begin<Ctx>()
          .opt(
            q
              .alt<Ctx>(
                qTemplateString,
                qPropertyAccessIdentifier,
                qVariableAccessIdentifier
              )
              .op(',')
              .handler((ctx) => storeInTokenMap(ctx, 'parentPath'))
          )
          .alt(
            qTemplateString,
            qPropertyAccessIdentifier,
            qVariableAccessIdentifier
          )
          .end(),
      })
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
      })
  )
  .handler(handleApplyFrom)
  .handler(cleanupTempVars);
