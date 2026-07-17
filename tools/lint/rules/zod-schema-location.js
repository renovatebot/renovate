import fs from 'node:fs';
import path from 'node:path';

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
 * Normalizes to forward slashes so the checks below work on Windows paths too.
 * @param {string} filename
 * @returns {string}
 */
function toPosix(filename) {
  return filename.replaceAll('\\', '/');
}

/** @type {Map<string, boolean>} */
const schemaFileByDir = new Map();

/**
 * True when a `schema.ts` file exists next to the linted file. Cached per
 * directory for the lifetime of the lint run.
 * @param {string} filename
 * @returns {boolean}
 */
function hasSiblingSchemaFile(filename) {
  const dir = path.dirname(filename);
  let result = schemaFileByDir.get(dir);
  if (result === undefined) {
    result = fs.existsSync(path.join(dir, 'schema.ts'));
    schemaFileByDir.set(dir, result);
  }
  return result;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      moveToSchemaFile:
        'Zod schema `{{name}}` is exported from outside a `schema.ts` file. Reviewers consistently ask for schemas to live in a colocated `schema.ts` — move it there.',
    },
  },
  create(context) {
    const filename = toPosix(
      context.filename ?? context.physicalFilename ?? '',
    );

    // Only enforce for module implementation files, not schema-utils itself, not tests.
    if (
      !filename.includes('/lib/modules/') ||
      filename.endsWith('.spec.ts') ||
      filename.endsWith('/schema.ts') ||
      // per-provider schema files colocated under a `schema/` directory follow the same convention
      filename.includes('/schema/') ||
      filename.includes('/lib/util/schema-utils/')
    ) {
      return {};
    }

    // Only enforce in directories that already follow the colocated `schema.ts`
    // convention. The mined reviewer feedback is "move this to schema.ts",
    // which presumes a schema.ts exists next to the file and the schema is
    // mixed into a logic file instead. Modules whose whole purpose is exporting
    // schemas under a different name (e.g. bazel `rules/*.ts` Target schemas or
    // bazel-module `parser/fragments.ts`) are a deliberate, accepted layout and
    // are not "schema mixed into logic", so directories without a schema.ts are
    // left alone.
    if (!hasSiblingSchemaFile(context.physicalFilename ?? context.filename)) {
      return {};
    }

    /** @type {string | null} */
    let zodBinding = null;
    /** @type {Set<string>} */
    const schemaHelperBindings = new Set();

    return {
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

      // Only `export const X = ...` is module scope *and* consumed elsewhere,
      // which is the syntactic signal that the schema belongs in schema.ts.
      // Non-exported schema `const`s are treated as intentionally local/trivial
      // (e.g. tightly coupled with file-local helpers) and are exempt.
      ExportNamedDeclaration(node) {
        if (node.declaration?.type !== 'VariableDeclaration') {
          return;
        }
        for (const declarator of node.declaration.declarations) {
          if (!declarator.init || declarator.id.type !== 'Identifier') {
            continue;
          }
          const leftmost = getLeftmostIdentifier(declarator.init);
          if (
            leftmost !== null &&
            (leftmost === zodBinding || schemaHelperBindings.has(leftmost))
          ) {
            context.report({
              node: declarator.id,
              messageId: 'moveToSchemaFile',
              data: { name: declarator.id.name },
            });
          }
        }
      },
    };
  },
};
