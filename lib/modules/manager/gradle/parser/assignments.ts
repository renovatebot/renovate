import { parser, query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import {
  cleanupTempVars,
  coalesceVariable,
  increaseNestingDepth,
  prependNestingDepth,
  qStringValue,
  qValueMatcher,
  qVariableAssignmentIdentifier,
  reduceNestingDepth,
  storeInTokenMap,
  storeVarToken,
} from './common';
import { qGroovyMapNotationDependencies } from './dependencies';
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

const qGroovySingleMapOfVarAssignment = q.alt(
  // foo: [group: "foo", name: "bar", version: "1.2.3"]
  q.begin<Ctx>().join(qGroovyMapNotationDependencies).end(),
  // foo: "1.2.3"
  q
    .sym(storeVarToken)
    .handler(prependNestingDepth)
    .handler(coalesceVariable)
    .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
    .op(':')
    .join(qValueMatcher)
    .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
    .handler(handleAssignment),
);

const qGroovyMapOfExpr = (
  search: q.QueryBuilder<Ctx, parser.Node>,
): q.QueryBuilder<Ctx, parser.Node> =>
  q.alt(
    q.sym(storeVarToken).op(':').tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '[',
      endsWith: ']',
      preHandler: increaseNestingDepth,
      search,
      postHandler: reduceNestingDepth,
    }),
    qGroovySingleMapOfVarAssignment,
  );

// versions = [ android: [ buildTools: '30.0.3' ], kotlin: '1.4.30' ]
const qGroovyMultiVarAssignment = qVariableAssignmentIdentifier
  .alt(q.op('='), q.op('+='))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '[',
    endsWith: ']',
    preHandler: increaseNestingDepth,
    search: qGroovyMapOfExpr(qGroovyMapOfExpr(qGroovySingleMapOfVarAssignment)),
    postHandler: reduceNestingDepth,
  })
  .handler(cleanupTempVars);

// "foo1" to "bar1"
const qKotlinSingleMapOfVarAssignment = qStringValue
  .sym('to')
  .handler(prependNestingDepth)
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .join(qValueMatcher)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment);

const qKotlinMapOfExpr = (
  search: q.QueryBuilder<Ctx, parser.Node>,
): q.QueryBuilder<Ctx, parser.Node> =>
  q.alt(
    qStringValue.sym('to').sym('mapOf').tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      preHandler: increaseNestingDepth,
      search,
      postHandler: reduceNestingDepth,
    }),
    qKotlinSingleMapOfVarAssignment,
  );

// val versions = mapOf("foo1" to "bar1", "foo2" to "bar2", "foo3" to "bar3")
export const qKotlinMultiMapOfVarAssignment = qVariableAssignmentIdentifier
  .op('=')
  .sym('mapOf')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    preHandler: increaseNestingDepth,
    search: qKotlinMapOfExpr(qKotlinMapOfExpr(qKotlinSingleMapOfVarAssignment)),
    postHandler: reduceNestingDepth,
  })
  .handler(cleanupTempVars);

export const qAssignments = q.alt(
  qGroovySingleVarAssignment,
  qGroovyMultiVarAssignment,
  qKotlinSingleVarAssignment,
  qKotlinSingleExtraVarAssignment,
  qKotlinMultiMapOfVarAssignment,
);
