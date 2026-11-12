import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Flags `x.replace(/^v/, '')` in favor of `stripVersionPrefix(x)` from
 * `lib/util/string.ts`.
 *
 * Only a pattern that removes nothing but a leading `v` counts: `/^v/`, `/^v/i`
 * and `/^[vV]/`, as a regex literal or wrapped in `regEx()`, with an empty
 * string replacement.
 */
export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferStripVersionPrefix:
        'Use `stripVersionPrefix()` from `lib/util/string.ts` instead of removing the leading `v` with `replace()`.',
    },
  },
  createOnce(context) {
    function getRegexLiteral(
      node: ESTree.Expression | ESTree.SpreadElement,
    ): ESTree.RegExpLiteral | null {
      if (node.type === 'Literal' && 'regex' in node) {
        return node;
      }
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'regEx' &&
        node.arguments.length === 1
      ) {
        return getRegexLiteral(node.arguments[0]);
      }
      return null;
    }

    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.computed ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'replace' ||
          node.arguments.length !== 2
        ) {
          return;
        }

        const [pattern, replacement] = node.arguments;
        if (replacement.type !== 'Literal' || replacement.value !== '') {
          return;
        }

        const literal = getRegexLiteral(pattern);
        if (!literal) {
          return;
        }

        const { pattern: source, flags } = literal.regex;
        const isPlain = source === '^v' && ['', 'i'].includes(flags);
        const isCharClass = flags === '' && ['^[vV]', '^[Vv]'].includes(source);
        if (isPlain || isCharClass) {
          context.report({ node, messageId: 'preferStripVersionPrefix' });
        }
      },
    };
  },
});
