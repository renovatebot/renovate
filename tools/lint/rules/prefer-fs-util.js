/**
 * Modules whose value imports are restricted in `lib/` in favor of the
 * scoped helpers from `lib/util/fs`.
 */
const RESTRICTED_MODULES = new Set([
  'fs',
  'node:fs',
  'fs/promises',
  'node:fs/promises',
  'fs-extra',
  'fs-extra/esm',
]);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      preferFsUtil:
        "Use the helpers from 'lib/util/fs' instead of importing '{{module}}' directly: they scope file access to the configured local/cache directories.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    // Only enforce in lib/ source files; the lib/util/fs implementation
    // itself needs the raw modules, and spec files legitimately manipulate
    // temporary files directly.
    if (
      !filename.includes('/lib/') ||
      filename.endsWith('.spec.ts') ||
      filename.includes('/lib/util/fs/')
    ) {
      return {};
    }
    return {
      ImportDeclaration(node) {
        // type-only imports don't touch the filesystem
        if (node.importKind === 'type') {
          return;
        }
        const source = node.source.value;
        if (typeof source === 'string' && RESTRICTED_MODULES.has(source)) {
          context.report({
            node,
            messageId: 'preferFsUtil',
            data: { module: source },
          });
        }
      },
    };
  },
};
