import type { SgNode } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import * as astGrep from '../../../../util/ast-grep';
import { coerceToString, extractKvArgs, namedChildren } from './common';

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

    const scopeDepTypes = namedChildren(args)
      .map((arg) => coerceToString(arg))
      .filter(is.truthy);

    const kvArgs = extractKvArgs(ancestor);
    const isOptional = kvArgs.optional === true;
    if (scopeDepTypes.length && isOptional) {
      scopeDepTypes.push('optional');
    }

    depTypes.push(scopeDepTypes);
  }

  return depTypes.reverse().flat();
}
