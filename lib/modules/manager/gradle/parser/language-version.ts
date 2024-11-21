import type { lexer } from 'good-enough-parser';
import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import { qDotOrBraceExpr } from './common';

// (21)
const qVersionNumber = q.tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  maxMatches: 1,
  startsWith: '(',
  endsWith: ')',
  search: q.num((ctx: Ctx, node: lexer.Token) => {
    ctx.javaLanguageVersion = node.value;
    return ctx;
  }),
});

// kotlin { jvmToolchain(17) }
// kotlin.jvmToolchain(17)
const qKotlinShortNotationToolchain = qDotOrBraceExpr(
  'kotlin',
  q.sym<Ctx>('jvmToolchain').join(qVersionNumber),
);

// JavaLanguageVersion.of(21)
const qJavaLanguageVersion = q
  .sym<Ctx>('JavaLanguageVersion')
  .op('.')
  .sym('of')
  .join(qVersionNumber);

// java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }
// kotlin { jvmToolchain { languageVersion.set(JavaLanguageVersion.of(17)) } }
const qLongFormToolchainVersion = qDotOrBraceExpr(
  regEx(/^(?:java|kotlin)$/),
  qDotOrBraceExpr(
    regEx(/^(?:toolchain|jvmToolchain)$/),
    q.sym<Ctx>('languageVersion').alt(
      q.op<Ctx>('=').join(qJavaLanguageVersion),
      q
        .op<Ctx>('.')
        .sym('set')
        .tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q.begin<Ctx>().join(qJavaLanguageVersion).end(),
        }),
    ),
  ),
);

export const qToolchainVersion = q.alt(
  qKotlinShortNotationToolchain,
  qLongFormToolchainVersion,
);
