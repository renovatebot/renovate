import type { Context, ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

const TOOLS_IMPORT_PATTERN = /(?:^|\/|\.\.\/)tools\//;

/** Every literal node oxc emits, all of which share `type: 'Literal'`. */
type Literal = Extract<ESTree.Node, { type: 'Literal' }>;

function check(context: Context, source: Literal): void {
  if (
    typeof source.value === 'string' &&
    TOOLS_IMPORT_PATTERN.test(source.value)
  ) {
    context.report({ node: source, messageId: 'noToolsImport' });
  }
}

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      noToolsImport: 'Importing from tools/ is not allowed in lib/',
    },
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        check(context, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          check(context, node.source);
        }
      },
      ExportAllDeclaration(node) {
        check(context, node.source);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          check(context, node.source);
        }
      },
    };
  },
});
