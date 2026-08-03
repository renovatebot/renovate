const TOOLS_IMPORT_PATTERN = /(?:^|\/|\.\.\/)tools\//;

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').Literal} source
 */
function check(context, source) {
  if (
    typeof source.value === 'string' &&
    TOOLS_IMPORT_PATTERN.test(source.value)
  ) {
    context.report({ node: source, messageId: 'noToolsImport' });
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      noToolsImport: 'Importing from tools/ is not allowed in lib/',
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    if (!filename.includes('/lib/')) {
      return {};
    }
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
};
