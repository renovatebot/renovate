import type { SgNode } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import * as astGrep from '../../../../util/ast-grep';
import { coerceToString, namedChildren } from './common';

const groupScopePattern = astGrep.rule`
  rule:
    kind: call
    all:
      - has:
          field: method
          regex: ^group$
      - has:
          field: arguments
          pattern: $ARGS
      - has:
          field: block
          pattern: $_
`;

export function extractScopedGroups(node: SgNode): string[] {
  const depTypes: string[][] = [];
  const ancestors = node.ancestors();
  for (const ancestor of ancestors) {
    const [args] = astGrep.extractMatches(ancestor, groupScopePattern, [
      'ARGS',
    ]);
    if (!args) {
      continue;
    }

    depTypes.push(
      namedChildren(args)
        .map((arg) => coerceToString(arg))
        .filter(is.truthy),
    );
  }

  return depTypes.reverse().flat();
}
