import { parser, query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import {
  cleanupTempVars,
  coalesceVariable,
  qStringValue,
  qTemplateString,
  qVariableAssignmentIdentifier,
  storeInTokenMap,
  storeVarToken,
} from './common';
import { handleAssignment } from './handlers';

// foo = "1.2.3"
const qGroovySingleVarAssignment = qVariableAssignmentIdentifier
  .op('=')
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .join(qStringValue)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment)
  .handler(cleanupTempVars);

// set("foo", "1.2.3")
const qKotlinSingleVarAssignment = q
  .sym<Ctx>(regEx(/^(?:set|version)$/))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
      .op(',')
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
      .handler(handleAssignment)
      .end(),
  })
  .handler(cleanupTempVars);

// val foo by extra { "1.2.3" }
const qKotlinSingleExtraVarAssignment = q
  .sym<Ctx>('val')
  .sym(storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .opt(q.op<Ctx>(':').sym('String'))
  .sym('by')
  .sym('extra')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
      .handler(handleAssignment)
      .end(),
  })
  .handler(cleanupTempVars);

// foo: "1.2.3"
const qGroovySingleMapOfVarAssignment = q
  .sym(storeVarToken)
  .handler((ctx) => {
    ctx.tmpTokenStore.backupVarTokens = ctx.varTokens;
    return ctx;
  })
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .op(':')
  .join(qTemplateString)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment)
  .handler((ctx) => {
    ctx.varTokens = ctx.tmpTokenStore.backupVarTokens!;
    ctx.varTokens.pop();
    return ctx;
  });

const qGroovyMapOfExpr = (
  search: q.QueryBuilder<Ctx, parser.Node>
): q.QueryBuilder<Ctx, parser.Node> =>
  q.alt(
    q
      .sym(storeVarToken)
      .op(':')
      .tree({
        type: 'wrapped-tree',
        maxDepth: 1,
        startsWith: '[',
        endsWith: ']',
        search,
        postHandler: (ctx: Ctx) => {
          ctx.varTokens.pop();
          return ctx;
        },
      }),
    qGroovySingleMapOfVarAssignment
  );

// versions = [ android: [ buildTools: '30.0.3' ], kotlin: '1.4.30' ]
const qGroovyMultiVarAssignment = qVariableAssignmentIdentifier
  .alt(q.op('='), q.op('+='))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '[',
    endsWith: ']',
    search: qGroovyMapOfExpr(qGroovyMapOfExpr(qGroovySingleMapOfVarAssignment)),
  })
  .handler(cleanupTempVars);

// "foo1" to "bar1"
const qKotlinSingleMapOfVarAssignment = qStringValue
  .sym('to')
  .handler((ctx) => {
    ctx.tmpTokenStore.backupVarTokens = ctx.varTokens;
    return ctx;
  })
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .join(qTemplateString)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment)
  .handler((ctx) => {
    ctx.varTokens = ctx.tmpTokenStore.backupVarTokens!;
    ctx.varTokens.pop();
    return ctx;
  });

const qKotlinMapOfExpr = (
  search: q.QueryBuilder<Ctx, parser.Node>
): q.QueryBuilder<Ctx, parser.Node> =>
  q.alt(
    qStringValue
      .sym('to')
      .sym('mapOf')
      .tree({
        type: 'wrapped-tree',
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search,
        postHandler: (ctx: Ctx) => {
          ctx.varTokens.pop();
          return ctx;
        },
      }),
    qKotlinSingleMapOfVarAssignment
  );

// val versions = mapOf("foo1" to "bar1", "foo2" to "bar2", "foo3" to "bar3")
const qKotlinMultiMapOfVarAssignment = qVariableAssignmentIdentifier
  .op('=')
  .sym('mapOf')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: qKotlinMapOfExpr(qKotlinMapOfExpr(qKotlinSingleMapOfVarAssignment)),
  })
  .handler(cleanupTempVars);

export const qAssignments = q.alt(
  qGroovySingleVarAssignment,
  qGroovyMultiVarAssignment,
  qKotlinSingleVarAssignment,
  qKotlinSingleExtraVarAssignment,
  qKotlinMultiMapOfVarAssignment
);
