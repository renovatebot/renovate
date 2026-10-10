import type { ESTree } from '@oxlint/plugins';

/**
 * Returns the name of an object property, class property or method: a
 * non-computed identifier or private identifier, or a string literal key.
 */
export function getPropertyName(
  node: Pick<ESTree.ObjectProperty, 'key' | 'computed'>,
): string | undefined {
  const { key } = node;
  if (
    (key.type === 'Identifier' || key.type === 'PrivateIdentifier') &&
    !node.computed
  ) {
    return key.name;
  }
  if (key.type === 'Literal' && typeof key.value === 'string') {
    return key.value;
  }
  return undefined;
}
