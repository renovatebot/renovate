import type { NapiConfig, SgNode } from '@ast-grep/napi';
import { codeBlock } from 'common-tags';
import { parseSingleYaml } from './yaml';

export function rule(
  strings: TemplateStringsArray,
  ...values: any[]
): NapiConfig {
  return parseSingleYaml<NapiConfig>(codeBlock(strings, ...values));
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

export function extractAllMatches(
  node: SgNode,
  rule: NapiConfig,
  keys: string[],
): SgNode[][] {
  const ms = node.findAll(rule);
  const result: SgNode[][] = [];
  for (const m of ms) {
    result.push(keys.map((key) => m.getMatch(key)!));
  }
  return result;
}

export function recede(node: SgNode): SgNode | null {
  return node.prev() ?? node.parent();
}
