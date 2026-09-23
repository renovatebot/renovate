import type { Context, ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

const VI_METHODS = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'importActual',
  'importMock',
]);

function isLocalPath(value: string): boolean {
  return value.startsWith('.') || value.startsWith('~');
}

function hasExtension(value: string): boolean {
  const lastSlash = value.lastIndexOf('/');
  const basename = lastSlash >= 0 ? value.slice(lastSlash + 1) : value;
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex > 0 && dotIndex < basename.length - 1;
}

function reportJsExtension(
  context: Context,
  node: ESTree.StringLiteral,
  value: string,
): void {
  const quote = node.raw?.[0] ?? "'";
  const fixed = `${value.slice(0, -3)}.ts`;
  context.report({
    node,
    messageId: 'useTsExtension',
    fix(fixer) {
      return fixer.replaceText(node, `${quote}${fixed}${quote}`);
    },
  });
}

function reportMissingExtension(
  context: Context,
  node: ESTree.StringLiteral,
): void {
  context.report({
    node,
    messageId: 'missingExtension',
  });
}

function checkLiteral(
  context: Context,
  sourceNode: ESTree.StringLiteral | null | undefined,
): void {
  if (!sourceNode) {
    return;
  }
  const value = sourceNode.value;
  if (!value || !isLocalPath(value)) {
    return;
  }
  if (value.endsWith('.js')) {
    reportJsExtension(context, sourceNode, value);
  }
}

export default defineRule({
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      useTsExtension: 'Use ".ts" extension instead of ".js" for local imports',
      missingExtension: 'Missing file extension on local import',
    },
  },
  createOnce(context) {
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
        if (
          node.source.type === 'Literal' &&
          typeof node.source.value === 'string'
        ) {
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
        if (arg?.type !== 'Literal' || typeof arg.value !== 'string') {
          return;
        }
        const value = arg.value;
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
});
