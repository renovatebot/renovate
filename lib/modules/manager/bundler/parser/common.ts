import ruby from '@ast-grep/lang-ruby';
import type { SgNode } from '@ast-grep/napi';
import { registerDynamicLanguage } from '@ast-grep/napi';
import * as astGrep from '../../../../util/ast-grep';
import { regEx } from '../../../../util/regex';

let rubyLoaded = false;

export function loadRuby(): void {
  if (!rubyLoaded) {
    registerDynamicLanguage({ ruby });
    rubyLoaded = true;
  }
}

export function namedChildren(node: SgNode): SgNode[] {
  return node.children().filter((child) => child.isNamed());
}

export function extractPlainString(node: SgNode | null): string | null {
  if (node?.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 1 && children[0].kind() === 'string_content') {
      return children[0].text();
    }
  }

  return null;
}

export function coerceToString(node: SgNode | null): string | null {
  if (!node) {
    return null;
  }

  if (node.kind() === 'identifier') {
    return node.text();
  }

  if (node.kind() === 'hash_key_symbol') {
    return node.text();
  }

  if (node.kind() === 'simple_symbol') {
    return node.text().replace(regEx(/^:/), '');
  }

  if (node.kind() === 'float' || node.kind() === 'integer') {
    return node.text();
  }

  return extractPlainString(node);
}

export function coerceToStringOrSymbol(
  node: SgNode | null,
): string | symbol | null {
  if (!node) {
    return null;
  }

  if (node.kind() === 'identifier') {
    return Symbol(node.text());
  }

  return coerceToString(node);
}

export const kvArgsPattern = astGrep.rule`
  rule:
    inside:
      kind: argument_list
      inside:
        kind: call
        pattern: $ROOT_NODE
    kind: pair
    all:
      - has:
          field: key
          pattern: $KEY
      - has:
          field: value
          pattern: $VAL
`;

type KvArgsVal = string | symbol | boolean;
export type KvArgs = Record<string, KvArgsVal | KvArgsVal[]>;

export function extractKvArgs(argsListNode: SgNode): KvArgs {
  const result: KvArgs = {};
  const pairs = astGrep.extractAllMatches(argsListNode, kvArgsPattern, [
    'KEY',
    'VAL',
  ]);

  for (const [keyNode, valNode] of pairs) {
    const key = coerceToString(keyNode);
    if (!key) {
      continue;
    }

    const val = coerceToStringOrSymbol(valNode);
    if (val) {
      result[key] = val;
      continue;
    }

    if (valNode.kind() === 'array') {
      const children = namedChildren(valNode);
      const stringValues = children.map((child) => coerceToString(child));
      if (stringValues.every((value) => value !== null)) {
        result[key] = stringValues;
      }
    }

    if (valNode.kind() === 'true') {
      result[key] = true;
    }

    if (valNode.kind() === 'false') {
      result[key] = false;
    }
  }

  return result;
}

export const stringAssignmentPattern = astGrep.rule`
  rule:
    kind: assignment
    all:
      - has:
          field: left
          pattern: $LEFT
      - has:
          field: right
          pattern: $RIGHT
`;

export type StringAssignmentResult =
  | { result: string; error?: undefined }
  | { result?: undefined; error: 'continue' | 'break' };

function matchAssignment(
  node: SgNode,
  variable: string,
): StringAssignmentResult {
  const [left, right] = astGrep.extractMatches(node, stringAssignmentPattern, [
    'LEFT',
    'RIGHT',
  ]);

  const identifier = coerceToString(left);
  if (identifier !== variable) {
    return { error: 'continue' };
  }

  const result = extractPlainString(right);
  if (!result) {
    return { error: 'break' };
  }

  return { result };
}

export function resolveIdentifier(
  node: SgNode,
  variable?: string,
): string | null {
  const identifier = variable ?? node.text();
  let cursor = astGrep.recede(node);
  while (cursor) {
    if (!cursor.isNamed()) {
      cursor = astGrep.recede(cursor);
      continue;
    }

    const { result, error } = matchAssignment(cursor, identifier);

    if (result) {
      return result;
    }

    if (error === 'break') {
      return null;
    }

    cursor = astGrep.recede(cursor);
  }

  return null;
}
