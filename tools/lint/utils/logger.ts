import type { ESTree } from '@oxlint/plugins';

/**
 * Extract the log level from a `logger.<level>(...)` or
 * `logger.once.<level>(...)` callee, or return `null` if the callee is not a
 * logger call.
 */
export function getLoggerLevel(callee: ESTree.Expression): string | null {
  if (
    callee.type !== 'MemberExpression' ||
    callee.computed ||
    callee.property.type !== 'Identifier'
  ) {
    return null;
  }
  const obj = callee.object;
  if (obj.type === 'Identifier' && obj.name === 'logger') {
    return callee.property.name;
  }
  if (
    obj.type === 'MemberExpression' &&
    !obj.computed &&
    obj.object.type === 'Identifier' &&
    obj.object.name === 'logger' &&
    obj.property.type === 'Identifier' &&
    obj.property.name === 'once'
  ) {
    return callee.property.name;
  }
  return null;
}

/**
 * Whether the expression looks like an error object: an identifier or member
 * access named like an error (`err`, `error`, `parseError`, ...) or a
 * `new SomeError(...)` expression. TS-specific wrapper expressions are
 * unwrapped first.
 */
export function isErrorIsh(node: ESTree.Expression): boolean {
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSSatisfiesExpression'
  ) {
    return isErrorIsh(node.expression);
  }
  if (node.type === 'Identifier') {
    return /err(?:or)?$/i.test(node.name);
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'
  ) {
    return /err(?:or)?$/i.test(node.property.name);
  }
  if (node.type === 'NewExpression') {
    return (
      node.callee.type === 'Identifier' && node.callee.name.endsWith('Error')
    );
  }
  return false;
}
