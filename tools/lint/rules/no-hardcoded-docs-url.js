const DOCS_URL = 'docs.renovatebot.com';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      noHardcodedDocsUrl:
        "Use config.productLinks.documentation instead of hardcoding 'docs.renovatebot.com' URLs.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    // Only enforce in lib/ source files, not tests or the file that defines config option defaults
    if (
      !filename.includes('/lib/') ||
      filename.includes('.spec.ts') ||
      filename.endsWith('lib/config/options/index.ts')
    ) {
      return {};
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string' && node.value.includes(DOCS_URL)) {
          context.report({ node, messageId: 'noHardcodedDocsUrl' });
        }
      },
      TemplateElement(node) {
        if (node.value?.raw?.includes(DOCS_URL)) {
          context.report({ node, messageId: 'noHardcodedDocsUrl' });
        }
      },
    };
  },
};
