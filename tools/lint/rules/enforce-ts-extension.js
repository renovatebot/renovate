const VI_METHODS = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'importActual',
  'importMock',
]);

/** @param {string} value */
function isLocalPath(value) {
  if (value.startsWith('.')) {
    return true;
  }
  return value.startsWith('~');
}

/** @param {string} value */
function hasExtension(value) {
  const lastSlash = value.lastIndexOf('/');
  const basename = lastSlash >= 0 ? value.slice(lastSlash + 1) : value;
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex > 0 && dotIndex < basename.length - 1;
}

/**
 * @param {import('estree').Literal} node
 * @returns {string | undefined}
 */
function getStringValue(node) {
  if (typeof node.value === 'string') {
    return node.value;
  }
  return undefined;
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').Literal} node
 * @param {string} value
 */
function reportJsExtension(context, node, value) {
  const quote = node.raw?.[0] ?? "'";
  const fixed = value.slice(0, -3) + '.ts';
  context.report({
    node,
    messageId: 'useTsExtension',
    fix(fixer) {
      return fixer.replaceText(node, `${quote}${fixed}${quote}`);
    },
  });
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').Literal} node
 */
function reportMissingExtension(context, node) {
  context.report({
    node,
    messageId: 'missingExtension',
  });
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').Literal | null | undefined} sourceNode
 */
function checkLiteral(context, sourceNode) {
  if (!sourceNode) {
    return;
  }
  const value = getStringValue(sourceNode);
  if (!value || !isLocalPath(value)) {
    return;
  }
  if (value.endsWith('.js')) {
    reportJsExtension(context, sourceNode, value);
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      useTsExtension: 'Use ".ts" extension instead of ".js" for local imports',
      missingExtension: 'Missing file extension on local import',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        checkLiteral(context, node.source);
      },
      ExportNamedDeclaration(node) {
        checkLiteral(context, node.source);
      },
      ExportAllDeclaration(node) {
        checkLiteral(context, node.source);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          checkLiteral(context, node.source);
        }
      },
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.object.type !== 'Identifier' ||
          callee.object.name !== 'vi' ||
          callee.property.type !== 'Identifier' ||
          !VI_METHODS.has(callee.property.name)
        ) {
          return;
        }
        const [arg] = node.arguments;
        if (arg?.type !== 'Literal') {
          return;
        }
        const value = getStringValue(arg);
        if (!value || !isLocalPath(value)) {
          return;
        }
        if (value.endsWith('.js')) {
          reportJsExtension(context, arg, value);
        } else if (!hasExtension(value)) {
          reportMissingExtension(context, arg);
        }
      },
    };
  },
};
