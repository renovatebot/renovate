import type { SgNode } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import * as astGrep from '../../../../util/ast-grep';
import { coerceToString, namedChildren, resolveIdentifier } from './common';

const globalSourcePattern = astGrep.rule`
  rule:
    kind: call
    inside:
      kind: program
    not:
      has:
        field: block
        pattern: $_
    all:
      - has:
          field: method
          regex: ^source$
      - has:
          field: arguments
          has:
            nthChild: 1
            pattern: $REGISTRY_URL
            any:
              - kind: string
              - kind: simple_symbol
              - kind: identifier
`;

export function aliasRubygemsSource(input: string): string {
  return input === 'rubygems' ? 'https://rubygems.org' : input;
}

export function extractGlobalRegistries(root: SgNode): string[] {
  const result: string[] = [];

  for (const m of root.findAll(globalSourcePattern)) {
    const node = m.getMatch('REGISTRY_URL')!;

    if (node.kind() === 'simple_symbol' && node.text() === ':rubygems') {
      result.push('https://rubygems.org');
    }

    if (node.kind() === 'string') {
      const children = namedChildren(node);
      const [child] = children;
      if (children.length === 1 && child.kind() === 'string_content') {
        result.push(child.text());
      }
    }

    if (node.kind() === 'identifier') {
      const resolvedValue = resolveIdentifier(node);
      if (resolvedValue) {
        result.push(resolvedValue);
      }
    }
  }

  return result.reverse();
}

const scopedCallPattern = astGrep.rule`
  rule:
    kind: call
    all:
      - has:
          field: method
          pattern: $METHOD
          regex: ^(?:group|source)$
      - has:
          field: arguments
          pattern: $ARGS
      - has:
          field: block
          pattern: $_
`;

export function extractParentBlockData(node: SgNode): [string[], string[]] {
  const depTypes: string[][] = [];
  const registryUrls: string[][] = [];
  const ancestors = node.ancestors();
  for (const ancestor of ancestors) {
    if (ancestor.kind() !== 'call') {
      continue;
    }

    const match = ancestor.find(scopedCallPattern);
    if (!match) {
      continue;
    }

    const method = match.getMatch('METHOD')!.text();
    const args = match.getMatch('ARGS')!;
    if (method === 'group') {
      depTypes.push(
        namedChildren(args)
          .map((arg) => coerceToString(arg))
          .filter(is.truthy),
      );
    }

    if (method === 'source') {
      registryUrls.push(
        namedChildren(args)
          .map((arg) =>
            arg.kind() === 'identifier'
              ? resolveIdentifier(arg)
              : coerceToString(arg),
          )
          .filter(is.truthy)
          .map(aliasRubygemsSource),
      );
    }
  }

  return [depTypes.reverse().flat(), registryUrls.flat()];
}
