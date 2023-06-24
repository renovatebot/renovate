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
import { handleAssignment } from './handlers';

const qKotlinSingleObjectVarAssignment = q.alt(
  // val dep = mapOf("qux" to "foo:bar:\${Versions.baz}")
  qKotlinMultiMapOfVarAssignment,
  // val dep: String = "foo:bar:" + Versions.baz
  qVariableAssignmentIdentifier
    .opt(q.op<Ctx>(':').sym('String'))
    .op('=')
    .handler(prependNestingDepth)
    .handler(coalesceVariable)
    .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
    .join(qValueMatcher)
    .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
    .handler(handleAssignment)
    .handler(cleanupTempVars)
);

// object foo { ... }
const qKotlinMultiObjectExpr = (
  search: q.QueryBuilder<Ctx, parser.Node>
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
    qKotlinSingleObjectVarAssignment
  );

export const qKotlinMultiObjectVarAssignment = qKotlinMultiObjectExpr(
  qKotlinMultiObjectExpr(
    qKotlinMultiObjectExpr(
      qKotlinMultiObjectExpr(qKotlinSingleObjectVarAssignment)
    )
  )
).handler(cleanupTempVars);
