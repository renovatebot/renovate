const TOOLS_IMPORT_PATTERN = /(?:^|\/|\.\.\/)tools\//;

module.exports = {
  meta: { name: 'renovate' },
  rules: {
    'no-tools-import': {
      meta: {
        type: 'problem',
        messages: {
          noToolsImport: 'Importing from tools/ is not allowed in lib/',
        },
      },
      /** @type {(context: any) => any} */
      create(context) {
        const filename = context.filename ?? context.physicalFilename ?? '';
        if (!filename.includes('/lib/')) {
          return {};
        }
        return {
          /** @type {(node: any) => void} */
          ImportDeclaration(node) {
            if (TOOLS_IMPORT_PATTERN.test(node.source.value)) {
              context.report({ node: node.source, messageId: 'noToolsImport' });
            }
          },
        };
      },
    },
  },
};
