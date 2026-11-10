import path from 'node:path';
import { defineRule } from '@oxlint/plugins';

/**
 * Type-only declarations belong in a colocated `types.ts`. The file that
 * collects them is itself exempt, and so is anything nested below a `types`
 * directory, which is the same convention split across several files.
 */
function isTypesFile(filename: string): boolean {
  const segments = filename.split(path.sep);
  const basename = segments.pop();
  return basename === 'types.ts' || segments.includes('types');
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      moveToTypesFile:
        'Exported type `{{name}}` is declared outside a `types.ts` file. Reviewers consistently ask for types to live in a colocated `types.ts` — move it there.',
    },
  },
  createOnce(context) {
    return {
      before() {
        if (isTypesFile(context.physicalFilename ?? context.filename)) {
          return false;
        }
      },

      // Only `export interface X` / `export type X = …` are both module scope
      // *and* consumed elsewhere, which is the syntactic signal that the type
      // belongs in types.ts. File-local types are intentionally local and are
      // exempt, and so are re-exports (`export type { X }`, `export type *`),
      // which carry no declaration of their own.
      ExportNamedDeclaration(node) {
        const { declaration } = node;
        if (
          declaration?.type !== 'TSInterfaceDeclaration' &&
          declaration?.type !== 'TSTypeAliasDeclaration'
        ) {
          return;
        }
        context.report({
          node: declaration.id,
          messageId: 'moveToTypesFile',
          data: { name: declaration.id.name },
        });
      },
    };
  },
});
