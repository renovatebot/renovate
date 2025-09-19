import type { SgNode } from '@ast-grep/napi';
import * as astGrep from '../../../../util/ast-grep';
import type { PackageDependency } from '../../types';
import { namedChildren } from './common';

const rubyVersionPattern = astGrep.rule`
  rule:
    kind: program
    has:
      kind: call
      all:
        - has:
            field: method
            regex: ^ruby$
        - has:
            field: arguments
            has:
              nthChild: 1
              pattern: $RUBY_VERSION
              any:
                - kind: string
                - kind: simple_symbol
`;

const rubyDoubleVersionPattern = astGrep.rule`
  rule:
    kind: program
    has:
      kind: call
      all:
        - has:
            field: method
            pattern: $_
            regex: ^ruby$
        - has:
            field: arguments
            pattern: $_
            all:
              - has:
                  kind: string
                  nthChild: 1
                  pattern: $LOWER
              - has:
                  kind: string
                  nthChild: 2
                  pattern: $HIGHER
`;

export function extractRubyVersion(root: SgNode): PackageDependency | null {
  const [lower, higher] = astGrep.extractMatches(
    root,
    rubyDoubleVersionPattern,
    ['LOWER', 'HIGHER'],
  );
  if (lower && higher) {
    const start = lower.range().start.index;
    const end = higher.range().end.index;
    return {
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: root.text().slice(start, end),
      managerData: { lineNumber: lower.range().start.line },
    };
  }

  const node = root.find(rubyVersionPattern)?.getMatch('RUBY_VERSION');
  if (!node) {
    return null;
  }

  const managerData = { lineNumber: node.range().start.line };

  if (node.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 0) {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue: '',
        skipReason: 'empty',
        managerData,
      };
    }

    if (children.length > 1) {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue: children.map((child) => child.text()).join(''),
        skipReason: 'version-placeholder',
        managerData,
      };
    }

    const [child] = children;
    const currentValue = child.text();

    if (child.kind() === 'interpolation') {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue,
        skipReason: 'version-placeholder',
        managerData,
      };
    }

    if (child.kind() === 'string_content') {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue,
        managerData,
      };
    }
  }

  if (node.kind() === 'simple_symbol') {
    return {
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: node.text(),
      skipReason: 'not-a-version',
      managerData,
    };
  }

  return {
    depName: 'ruby',
    datasource: 'ruby-version',
    currentValue: node.text(),
    skipReason: 'unsupported-version',
    managerData,
  };
}
