import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Walk the init expression to its leftmost identifier by unwrapping
 * CallExpression.callee and MemberExpression.object chains.
 */
function getLeftmostIdentifier(node: ESTree.Expression): string | null {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'CallExpression') {
    return getLeftmostIdentifier(node.callee);
  }
  if (node.type === 'MemberExpression') {
    return getLeftmostIdentifier(node.object);
  }
  return null;
}

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      noSchemaSuffix:
        'Zod schema should not use a `Schema` suffix; name it `{{name}}` instead.',
      mismatchedInferType:
        "Inferred type should share its schema's name (expected `type {{name}} = ...`).",
    },
  },
  createOnce(context) {
    let zodBinding: string | null = null;
    let schemaNames = new Set<string>();
    /**
     * Local names imported from a `schema-utils` module. These helpers
     * (`LooseArray`, `Json`, …) produce Zod schemas even though their
     * leftmost identifier is not the `z` binding, so a `const` built from
     * one is a schema. Non-schema exports (`withDebugMessage`, etc.) are
     * harmless here — they never appear as the leftmost identifier of a
     * schema `const`.
     */
    let schemaHelperBindings = new Set<string>();

    return {
      before() {
        zodBinding = null;
        schemaNames = new Set();
        schemaHelperBindings = new Set();
      },

      ImportDeclaration(node) {
        if (node.source.value === 'zod' || node.source.value === 'zod/v4') {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.type === 'Identifier' &&
              specifier.imported.name === 'z'
            ) {
              zodBinding = specifier.local.name;
            }
          }
          return;
        }
        const source = node.source.value;
        if (
          typeof source === 'string' &&
          source.split('/').includes('schema-utils')
        ) {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.type === 'Identifier'
            ) {
              schemaHelperBindings.add(specifier.local.name);
            }
          }
        }
      },

      VariableDeclarator(node) {
        if (!node.init || node.id.type !== 'Identifier') {
          return;
        }
        const leftmost = getLeftmostIdentifier(node.init);
        if (!leftmost) {
          return;
        }
        if (
          leftmost !== zodBinding &&
          !schemaHelperBindings.has(leftmost) &&
          !schemaNames.has(leftmost)
        ) {
          return;
        }

        const name = node.id.name;
        schemaNames.add(name);

        if (!name.endsWith('Schema')) {
          return;
        }
        context.report({
          node: node.id,
          messageId: 'noSchemaSuffix',
          data: { name: name.slice(0, -6) },
        });
      },

      TSTypeAliasDeclaration(node) {
        if (!zodBinding) {
          return;
        }
        const { typeAnnotation } = node;
        if (typeAnnotation.type !== 'TSTypeReference') {
          return;
        }

        // Match z.infer<...> — TSQualifiedName where left = zodBinding, right = 'infer'
        const refTypeName = typeAnnotation.typeName;
        if (
          refTypeName.type !== 'TSQualifiedName' ||
          refTypeName.left.type !== 'Identifier' ||
          refTypeName.left.name !== zodBinding ||
          refTypeName.right.type !== 'Identifier' ||
          refTypeName.right.name !== 'infer'
        ) {
          return;
        }

        // oxc emits the type arguments as `typeArguments`.
        const typeArgs = typeAnnotation.typeArguments;
        if (typeArgs?.params.length !== 1) {
          return;
        }

        const [typeArg] = typeArgs.params;
        if (typeArg.type !== 'TSTypeQuery' || !typeArg.exprName) {
          return;
        }
        const { exprName } = typeArg;
        if (exprName.type !== 'Identifier') {
          return;
        }

        const schemaName = exprName.name;
        if (node.id.name !== schemaName) {
          context.report({
            node: node.id,
            messageId: 'mismatchedInferType',
            data: { name: schemaName },
          });
        }
      },
    };
  },
});
