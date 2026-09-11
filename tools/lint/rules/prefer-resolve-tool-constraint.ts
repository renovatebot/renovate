import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

const constraintKeys = new Set(['constraints', 'extractedConstraints']);

/**
 * Parameter types under which a destructured `constraints` is the manager
 * config. `UpdateArtifact` carries it nested under `config`.
 */
const configTypeNames = new Set([
  'UpdateArtifactsConfig',
  'PostUpdateConfig',
  'UpdateArtifact',
]);

function keyName(node: ESTree.Node): string | undefined {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  return undefined;
}

/**
 * Strips wrappers that don't change the accessed object, so `config!.x`,
 * `(config as Foo).x` and the `ChainExpression` around `config?.x` all match.
 */
function unwrap(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (
    current.type === 'ChainExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TSAsExpression' ||
    current.type === 'TSSatisfiesExpression'
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * Whether an expression denotes a manager config: `config`, anything named
 * `…Config`, or a `.config` property such as `updateArtifact.config`.
 */
function isConfigExpression(input: ESTree.Node): boolean {
  const node = unwrap(input);
  if (node.type === 'Identifier') {
    return node.name === 'config' || node.name.endsWith('Config');
  }
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    keyName(node.property) === 'config'
  );
}

/**
 * Whether a type annotation mentions one of the config types, looking through
 * wrappers like `Partial<PostUpdateConfig>` and unions.
 */
function mentionsConfigType(node: ESTree.Node | null | undefined): boolean {
  if (!node) {
    return false;
  }
  if (node.type === 'TSTypeAnnotation') {
    return mentionsConfigType(node.typeAnnotation);
  }
  if (node.type === 'TSTypeReference') {
    if (
      node.typeName.type === 'Identifier' &&
      configTypeNames.has(node.typeName.name)
    ) {
      return true;
    }
    return (node.typeArguments?.params ?? []).some(mentionsConfigType);
  }
  if (node.type === 'TSUnionType' || node.type === 'TSIntersectionType') {
    return node.types.some(mentionsConfigType);
  }
  return false;
}

/**
 * Whether an object pattern destructures the manager config, i.e.
 * `const { constraints } = config`, `{ constraints }: UpdateArtifactsConfig`
 * as a parameter, or `{ config: { constraints } }: UpdateArtifact`.
 */
function isConfigPattern(
  pattern: ESTree.ObjectPattern | ESTree.ObjectAssignmentTarget,
): boolean {
  const { parent } = pattern;
  if (parent.type === 'VariableDeclarator') {
    return !!parent.init && isConfigExpression(parent.init);
  }
  if (parent.type === 'Property' && parent.value === pattern) {
    return keyName(parent.key) === 'config';
  }
  const isParameter =
    parent.type === 'FunctionDeclaration' ||
    parent.type === 'FunctionExpression' ||
    parent.type === 'ArrowFunctionExpression' ||
    parent.type === 'AssignmentPattern';
  if (!isParameter) {
    return false;
  }
  // An untyped parameter destructuring `constraints` is a config in manager
  // code; a typed one is only reported when it names a config type.
  return !pattern.typeAnnotation || mentionsConfigType(pattern.typeAnnotation);
}

/**
 * Flags reading `constraints` or `extractedConstraints` from a manager config
 * directly. `resolveToolConstraint()` in `lib/modules/manager/util.ts` is the
 * one place that decides how the user's `constraints`, a value derived from the
 * updated package files and the constraints collected during extraction are
 * combined, so every tool constraint has to be resolved through it.
 *
 * Writes (`config.constraints = …`) are not reads and are left alone, as are
 * the same properties on package files (`packageFile.extractedConstraints`),
 * which extraction code has to populate.
 */
export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      preferResolveToolConstraint:
        'Do not read `{{name}}` from the config directly. Resolve tool constraints with `resolveToolConstraint()` from `lib/modules/manager/util.ts`, which applies user config, a value derived from the updated files and the extracted constraints in one consistent order.',
    },
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        if (node.computed) {
          return;
        }
        const name = keyName(node.property);
        if (!name || !constraintKeys.has(name)) {
          return;
        }
        if (!isConfigExpression(node.object)) {
          return;
        }
        const { parent } = node;
        if (parent.type === 'AssignmentExpression' && parent.left === node) {
          return;
        }
        context.report({
          node,
          messageId: 'preferResolveToolConstraint',
          data: { name },
        });
      },

      Property(node) {
        if (node.parent.type !== 'ObjectPattern') {
          return;
        }
        const name = keyName(node.key);
        if (!name || !constraintKeys.has(name)) {
          return;
        }
        if (!isConfigPattern(node.parent)) {
          return;
        }
        context.report({
          node,
          messageId: 'preferResolveToolConstraint',
          data: { name },
        });
      },
    };
  },
});
