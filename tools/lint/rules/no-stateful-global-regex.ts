import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Return true when the given string of regex flags makes a regex stateful
 * (`lastIndex` is advanced by `test()`/`exec()` calls).
 */
function hasStatefulFlag(flags: string): boolean {
  return flags.includes('g') || flags.includes('y');
}

function isRegexLiteral(
  node: ESTree.Node | undefined,
): node is ESTree.RegExpLiteral {
  return node?.type === 'Literal' && 'regex' in node;
}

/**
 * Detect an initializer that produces a regex with the `g` or `y` flag:
 * a regex literal, `regEx('...', 'g')` (flags as second argument), or
 * `regEx(/.../g)` (flagged regex literal as first argument).
 */
function isStatefulRegexInit(init: ESTree.Expression): boolean {
  if (isRegexLiteral(init)) {
    return hasStatefulFlag(init.regex.flags);
  }
  if (
    init.type === 'CallExpression' &&
    init.callee.type === 'Identifier' &&
    init.callee.name === 'regEx'
  ) {
    const [pattern, flags] = init.arguments;
    if (flags) {
      return (
        flags.type === 'Literal' &&
        typeof flags.value === 'string' &&
        hasStatefulFlag(flags.value)
      );
    }
    return isRegexLiteral(pattern) && hasStatefulFlag(pattern.regex.flags);
  }
  return false;
}

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      noStatefulGlobalRegex:
        'Global-flag regexes are stateful (lastIndex); do not share them at module scope for test()/exec() — drop the flag, localize the regex, or use matchAll().',
    },
  },
  createOnce(context) {
    /**
     * Module-scope `const`/`let` bindings initialized with a stateful regex,
     * keyed by variable name.
     */
    const statefulDeclarations = new Map<string, ESTree.Node>();
    /** Names later called with `.test(` or `.exec(` anywhere in the file. */
    const statefulUsages = new Set<string>();

    return {
      before() {
        statefulDeclarations.clear();
        statefulUsages.clear();
      },

      Program(node) {
        for (const statement of node.body) {
          const declaration =
            statement.type === 'ExportNamedDeclaration'
              ? statement.declaration
              : statement;
          if (declaration?.type !== 'VariableDeclaration') {
            continue;
          }
          for (const declarator of declaration.declarations) {
            if (
              declarator.id.type === 'Identifier' &&
              declarator.init &&
              isStatefulRegexInit(declarator.init)
            ) {
              statefulDeclarations.set(declarator.id.name, declarator.id);
            }
          }
        }
      },

      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.property.type === 'Identifier' &&
          (callee.property.name === 'test' || callee.property.name === 'exec')
        ) {
          statefulUsages.add(callee.object.name);
        }
      },

      'Program:exit'() {
        for (const [name, id] of statefulDeclarations) {
          if (statefulUsages.has(name)) {
            context.report({ node: id, messageId: 'noStatefulGlobalRegex' });
          }
        }
      },
    };
  },
});
