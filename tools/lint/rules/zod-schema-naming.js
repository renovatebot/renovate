/**
 * Walk the init expression to its leftmost identifier by unwrapping
 * CallExpression.callee and MemberExpression.object chains.
 * @param {import('estree').Expression | import('estree').Super} node
 * @returns {string | null}
 */
function getLeftmostIdentifier(node) {
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

/**
 * Minimal shapes of the TypeScript AST nodes inspected by Check B. oxc emits a
 * typescript-eslint-compatible AST, but these nodes are absent from ESLint's
 * estree typings and oxlint does not export its own node types, so the fields
 * this rule reads are described here.
 *
 * @typedef {{ type: string, name: string }} TSName
 * @typedef {{ type: string, left: TSName, right: TSName }} TSQualifiedName
 * @typedef {{ type: string, exprName?: TSName }} TSTypeQuery
 * @typedef {{ params: TSTypeQuery[] }} TSTypeArgs
 * @typedef {{ type: string, typeName: TSQualifiedName, typeArguments?: TSTypeArgs, typeParameters?: TSTypeArgs }} TSTypeReference
 * @typedef {{ id: import('estree').Identifier, typeAnnotation?: TSTypeReference }} TSTypeAliasDeclaration
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      noSchemaSuffix:
        'Zod schema should not use a `Schema` suffix; name it `{{name}}` instead.',
      mismatchedInferType:
        "Inferred type should share its schema's name (expected `type {{name}} = ...`).",
    },
  },
  create(context) {
    /** @type {string | null} */
    let zodBinding = null;
    /** @type {Set<string>} */
    const schemaNames = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'zod' && node.source.value !== 'zod/v4') {
          return;
        }
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'z'
          ) {
            zodBinding = specifier.local.name;
          }
        }
      },

      VariableDeclarator(node) {
        if (!zodBinding || !node.init || node.id.type !== 'Identifier') {
          return;
        }
        const leftmost = getLeftmostIdentifier(node.init);
        if (!leftmost) {
          return;
        }
        if (leftmost !== zodBinding && !schemaNames.has(leftmost)) {
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

      /** @param {unknown} node */
      TSTypeAliasDeclaration(node) {
        if (!zodBinding) {
          return;
        }
        const decl = /** @type {TSTypeAliasDeclaration} */ (node);
        const { typeAnnotation } = decl;
        if (typeAnnotation?.type !== 'TSTypeReference') {
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

        // oxc emits `typeArguments`; keep `typeParameters` as a fallback for other serializers.
        const typeArgs =
          typeAnnotation.typeArguments ?? typeAnnotation.typeParameters;
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
        if (decl.id.name !== schemaName) {
          context.report({
            node: decl.id,
            messageId: 'mismatchedInferType',
            data: { name: schemaName },
          });
        }
      },
    };
  },
};
