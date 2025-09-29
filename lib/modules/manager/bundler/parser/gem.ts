import type { SgNode } from '@ast-grep/napi';
import * as astGrep from '../../../../util/ast-grep';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import { extractPlainString, namedChildren } from './common';

const gemSingularVersionPattern = astGrep.rule`
  rule:
    kind: call
    pattern: $_
    has:
      field: arguments
      pattern: $_
      has:
        nthChild: 2
        pattern: $VERSION
        any:
          - kind: string
          - kind: float
          - kind: integer
`;

const gemDoubleRangePattern = astGrep.rule`
  rule:
    kind: call
    pattern: $_
    has:
      field: arguments
      pattern: $_
      all:
        - has:
            kind: string
            nthChild: 2
            pattern: $LOWER
        - has:
            kind: string
            nthChild: 3
            pattern: $HIGHER
`;

export const gemDefPattern = astGrep.rule`
  utils:
    string-or-symbol:
      any:
        - kind: simple_symbol
        - kind: string
  rule:
    kind: call
    all:
      - has:
          field: method
          regex: ^gem$
      - has:
          field: arguments
          pattern: $ARGS
          has:
            matches: string-or-symbol
            pattern: $DEP_NAME
            nthChild: 1
`;

export function extractDepNameData(
  gemDefNode: SgNode,
): Pick<PackageDependency, 'depName' | 'skipReason' | 'managerData'> {
  const node = gemDefNode.getMatch('DEP_NAME');
  if (!node) {
    return { skipReason: 'missing-depname' };
  }

  const managerData = { lineNumber: node.range().start.line };

  if (node.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 0 || children.length > 1) {
      const depName = children.map((child) => child.text()).join('');
      return {
        depName,
        skipReason: 'invalid-name',
        managerData,
      };
    }

    const [child] = children;
    const depName = child.text();
    if (child.kind() !== 'string_content') {
      return { depName, skipReason: 'invalid-name', managerData };
    }

    return { depName, managerData };
  }

  if (node.kind() === 'simple_symbol') {
    const depName = node.text().replace(regEx(/^:/), '');
    return { depName, managerData };
  }

  /* v8 ignore start -- should not happen */
  const depName = node.text();
  return { depName, skipReason: 'invalid-name', managerData };
  /* v8 ignore stop */
}

export function extractVersionData(
  gemDefNode: SgNode,
): Pick<PackageDependency, 'currentValue' | 'skipReason' | 'managerData'> {
  const doubleRangeMatch = astGrep.extractMatches(
    gemDefNode,
    gemDoubleRangePattern,
    ['LOWER', 'HIGHER'],
  );
  const [lowerStr, higherStr] = doubleRangeMatch.map(extractPlainString);
  if (lowerStr?.trim().startsWith('>') && higherStr) {
    const [lower, higher] = doubleRangeMatch;
    const offset = gemDefNode.range().start.index;
    const start = lower.range().start.index - offset;
    const end = higher.range().end.index - offset;
    return {
      currentValue: gemDefNode.text().slice(start, end),
      managerData: { lineNumber: lower.range().start.line },
    };
  }

  const [versionNode] = astGrep.extractMatches(
    gemDefNode,
    gemSingularVersionPattern,
    ['VERSION'],
  );

  if (!versionNode) {
    const managerData = { lineNumber: gemDefNode.range().start.line };
    return { skipReason: 'unspecified-version', managerData };
  }

  const managerData = { lineNumber: versionNode.range().start.line };

  if (versionNode.kind() === 'float' || versionNode.kind() === 'integer') {
    return { currentValue: versionNode.text(), managerData };
  }

  const children = namedChildren(versionNode);
  if (children.length === 0) {
    return { currentValue: '', skipReason: 'empty', managerData };
  }

  if (children.length > 1) {
    return {
      currentValue: children.map((child) => child.text()).join(''),
      skipReason: 'version-placeholder',
      managerData,
    };
  }

  const [child] = children;
  const currentValue = child.text();

  if (child.kind() === 'interpolation') {
    return { currentValue, skipReason: 'version-placeholder', managerData };
  }

  if (child.kind() !== 'string_content') {
    return { skipReason: 'unsupported-version', managerData };
  }

  return { currentValue, managerData };
}
