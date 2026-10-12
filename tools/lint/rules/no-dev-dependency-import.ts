import fs from 'node:fs';
import path from 'node:path';
import type { Context, ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/** Every literal node oxc emits, all of which share `type: 'Literal'`. */
type Literal = Extract<ESTree.Node, { type: 'Literal' }>;

const packageJsonPath = path.join(import.meta.dirname, '../../../package.json');
// oxlint-disable-next-line no-sync -- lint rules run synchronously, so async fs is not an option
const packageJsonRaw = fs.readFileSync(packageJsonPath, 'utf8');
const pkg = JSON.parse(packageJsonRaw) as {
  devDependencies?: Record<string, string>;
};
const devDependencies = new Set(Object.keys(pkg.devDependencies ?? {}));

/** Resolves a bare import specifier to the package name it belongs to, or `null` for relative/absolute imports. */
function packageName(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return null;
  }
  const segments = specifier.split('/');
  return specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
}

function checkSource(context: Context, source: Literal): void {
  if (typeof source.value !== 'string') {
    return;
  }
  const name = packageName(source.value);
  if (name && devDependencies.has(name)) {
    context.report({
      node: source,
      messageId: 'noDevDependencyImport',
      data: { name },
    });
  }
}

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      noDevDependencyImport:
        '`{{name}}` is a devDependency and is not installed for users of the published package. Move it to `dependencies` in package.json, or use a type-only import if only types are needed.',
    },
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') {
          return;
        }
        if (
          node.specifiers.length > 0 &&
          node.specifiers.every(
            (specifier) =>
              specifier.type === 'ImportSpecifier' &&
              specifier.importKind === 'type',
          )
        ) {
          return;
        }
        checkSource(context, node.source);
      },
      ExportNamedDeclaration(node) {
        if (!node.source || node.exportKind === 'type') {
          return;
        }
        if (
          node.specifiers.length > 0 &&
          node.specifiers.every((specifier) => specifier.exportKind === 'type')
        ) {
          return;
        }
        checkSource(context, node.source);
      },
      ExportAllDeclaration(node) {
        if (node.exportKind === 'type') {
          return;
        }
        checkSource(context, node.source);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          checkSource(context, node.source);
        }
      },
    };
  },
});
