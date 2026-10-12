import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Strips wrappers that don't change the accessed property so the same matcher
 * handles `a.next.url`, `a?.next?.url` (ChainExpression) and `a!.next!.url`
 * (TSNonNullExpression).
 */
function unwrap(node: ESTree.Node | undefined): ESTree.Node | undefined {
  let current = node;
  while (
    current?.type === 'ChainExpression' ||
    current?.type === 'TSNonNullExpression'
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * Matches a member access ending in `.next.url` or `.next.href`, i.e. the URL of
 * a pagination "next" link parsed from a `Link` header (`parseLinkHeader`).
 */
function isNextUrlNode(input: ESTree.Node | undefined): boolean {
  const node = unwrap(input);
  if (node?.type !== 'MemberExpression') {
    return false;
  }
  const { property } = node;
  if (
    property.type !== 'Identifier' ||
    (property.name !== 'url' && property.name !== 'href')
  ) {
    return false;
  }
  const inner = unwrap(node.object);
  return (
    inner?.type === 'MemberExpression' &&
    inner.property.type === 'Identifier' &&
    inner.property.name === 'next'
  );
}

/**
 * Flags following a paginated `next` URL (from a `Link` header) via `new URL()`
 * or `parseUrl()` without validating its origin.
 *
 * This could lead to Server Side Request Forgery if a malicious/compromised registry has modified their returned `next` URL,
 * but could also be a sign of misconfiguration - either way, we should not allow it.
 *
 * Datasources have no legitimate reason to paginate across origins, so resolve
 * such URLs with `resolveSameOriginUrl()` from `lib/util/url.ts`, which drops
 * cross-origin targets.
 *
 * This focusses on Datasource-driven pagination, as Platform-driven pagination is allowed to run across origins (via Self-Hosted Experimental con fig)
 */
export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      noUnvalidatedPaginationUrl:
        "Do not follow a pagination `next` URL directly. Resolve it with resolveSameOriginUrl() from 'lib/util/url.ts' so a malicious registry cannot redirect the authenticated request to another host.",
    },
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'URL' &&
          node.arguments.some(isNextUrlNode)
        ) {
          context.report({ node, messageId: 'noUnvalidatedPaginationUrl' });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'parseUrl' &&
          node.arguments.some(isNextUrlNode)
        ) {
          context.report({ node, messageId: 'noUnvalidatedPaginationUrl' });
        }
      },
    };
  },
});
