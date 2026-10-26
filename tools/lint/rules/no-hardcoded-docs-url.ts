import { defineRule } from '@oxlint/plugins';

// Regex used instead of String#includes() to avoid CodeQL's js/incomplete-url-substring-sanitization false positive.
const DOCS_URL_RE = /https:\/\/docs\.renovatebot\.com/;

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      noHardcodedDocsUrl:
        "Use config.productLinks.documentation instead of hardcoding 'docs.renovatebot.com' URLs.",
    },
  },
  createOnce(context) {
    return {
      Literal(node) {
        // oxlint-disable-next-line typescript/prefer-includes -- regex avoids CodeQL js/incomplete-url-substring-sanitization
        if (typeof node.value === 'string' && DOCS_URL_RE.test(node.value)) {
          context.report({ node, messageId: 'noHardcodedDocsUrl' });
        }
      },
      TemplateElement(node) {
        // oxlint-disable-next-line typescript/prefer-includes -- regex avoids CodeQL js/incomplete-url-substring-sanitization
        if (node.value.raw && DOCS_URL_RE.test(node.value.raw)) {
          context.report({ node, messageId: 'noHardcodedDocsUrl' });
        }
      },
    };
  },
});
