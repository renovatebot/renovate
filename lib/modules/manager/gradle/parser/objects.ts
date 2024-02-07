import { parser, query as q } from 'good-enough-parser';
import type { Ctx } from '../types';
import { qKotlinMultiMapOfVarAssignment } from './assignments';
import {
  cleanupTempVars,
  coalesceVariable,
  increaseNestingDepth,
  prependNestingDepth,
  qValueMatcher,
  qVariableAssignmentIdentifier,
  reduceNestingDepth,
  storeInTokenMap,
  storeVarToken,
} from './common';
import { qDependencyStrings } from './dependencies';
import { handleAssignment } from './handlers';

const qKotlinListOfAssignment = q.sym<Ctx>('listOf').tree({
  type: 'wrapped-tree',
  startsWith: '(',
  endsWith: ')',
  search: qDependencyStrings,
});

const qKotlinSingleObjectVarAssignment = q.alt(
  // val dep = mapOf("qux" to "foo:bar:\${Versions.baz}")
  qKotlinMultiMapOfVarAssignment,
  qVariableAssignmentIdentifier
    .opt(q.op<Ctx>(':').sym('String'))
    .op('=')
    .handler(prependNestingDepth)
    .handler(coalesceVariable)
    .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
    .alt(
      // val deps = listOf("androidx.appcompat:appcompat:$baz", listOf("androidx.webkit:webkit:${Versions.baz}"))
      qKotlinListOfAssignment,
      // val dep: String = "foo:bar:" + Versions.baz
      qValueMatcher
        .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
        .handler(handleAssignment),
    )
    .handler(cleanupTempVars),
);

// object foo { ... }
const qKotlinMultiObjectExpr = (
  search: q.QueryBuilder<Ctx, parser.Node>,
): q.QueryBuilder<Ctx, parser.Node> =>
  q.alt(
    q.sym<Ctx>('object').sym(storeVarToken).tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '{',
      endsWith: '}',
      preHandler: increaseNestingDepth,
      search,
      postHandler: reduceNestingDepth,
    }),
    qKotlinSingleObjectVarAssignment,
  );

export const qKotlinMultiObjectVarAssignment = qKotlinMultiObjectExpr(
  qKotlinMultiObjectExpr(
    qKotlinMultiObjectExpr(
      qKotlinMultiObjectExpr(qKotlinSingleObjectVarAssignment),
    ),
  ),
).handler(cleanupTempVars);
