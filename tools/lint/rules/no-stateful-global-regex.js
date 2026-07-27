/**
 * Return true when the given string of regex flags makes a regex stateful
 * (`lastIndex` is advanced by `test()`/`exec()` calls).
 * @param {string} flags
 * @returns {boolean}
 */
function hasStatefulFlag(flags) {
  return flags.includes('g') || flags.includes('y');
}

/**
 * @param {import('estree').Node | undefined} node
 * @returns {node is import('estree').RegExpLiteral}
 */
function isRegexLiteral(node) {
  return node?.type === 'Literal' && 'regex' in node;
}

/**
 * Detect an initializer that produces a regex with the `g` or `y` flag:
 * a regex literal, `regEx('...', 'g')` (flags as second argument), or
 * `regEx(/.../g)` (flagged regex literal as first argument).
 * @param {import('estree').Expression} init
 * @returns {boolean}
 */
function isStatefulRegexInit(init) {
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

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      noStatefulGlobalRegex:
        'Global-flag regexes are stateful (lastIndex); do not share them at module scope for test()/exec() — drop the flag, localize the regex, or use matchAll().',
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    if (!filename.includes('/lib/')) {
      return {};
    }

    /**
     * Module-scope `const`/`let` bindings initialized with a stateful regex,
     * keyed by variable name.
     * @type {Map<string, import('estree').Node>}
     */
    const statefulDeclarations = new Map();
    /**
     * Names later called with `.test(` or `.exec(` anywhere in the file.
     * @type {Set<string>}
     */
    const statefulUsages = new Set();

    return {
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
};
