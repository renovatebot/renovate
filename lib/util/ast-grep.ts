import type { NapiConfig, SgNode } from '@ast-grep/napi';
import { parseSingleYaml } from './yaml';

export function rule(
  strings: TemplateStringsArray,
  ...values: any[]
): NapiConfig {
  return parseSingleYaml<NapiConfig>(strings[0]);
}

export function extractMatches(
  node: SgNode,
  rule: NapiConfig,
  keys: string[],
): SgNode[] {
  const m = node.find(rule);
  if (m?.id() !== node.id()) {
    return [];
  }

  return keys.map((key) => m.getMatch(key)!);
}

/**
 * Extract multiple matches from a node.
 *
 * Marking the ROOT_NODE will help with precision by ensuring matches are within the specified scope.
 * For example, in `foo(bar(baz))`, using ROOT_NODE prevents unintended matches like interpreting `foo(baz)`
 * when we only want matches within the correct nested structure.
 */
export function extractAllMatches(
  rootNode: SgNode,
  rule: NapiConfig,
  keys: string[],
): SgNode[][] {
  const ms = rootNode.findAll(rule);
  const result: SgNode[][] = [];

  const rootNodeId = rootNode.id();
  for (const m of ms) {
    const anchorNode = m.getMatch('ROOT_NODE');
    if (anchorNode && anchorNode.id() !== rootNodeId) {
      continue;
    }

    result.push(keys.map((key) => m.getMatch(key)!));
  }

  return result;
}

export function recede(node: SgNode): SgNode | null {
  return node.prev() ?? node.parent();
}
