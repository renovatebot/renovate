/**
 * @fileoverview Enforce using 'repository' instead of 'repo' in logger calls
 * @author Renovate Team
 */

/**
 * ESLint rule to enforce consistent naming in logger calls.
 * Prefers 'repository' over 'repo' in structured logging parameters.
 *
 * ❌ Bad:
 *   logger.debug({ repo, other }, 'message');
 *   logger.info({ repo: value }, 'message');
 *
 * ✅ Good:
 *   logger.debug({ repository, other }, 'message');
 *   logger.info({ repository: value }, 'message');
 */

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Enforce using 'repository' instead of 'repo' in logger structured parameters",
      recommended: false,
    },
    fixable: 'code',
    schema: [],
    messages: {
      useRepository:
        "Use 'repository' instead of 'repo' in logger parameters for consistency",
    },
  },

  create(context) {
    /**
     * Check if a node is a logger method call (logger.debug, logger.warn, etc.)
     */
    function isLoggerCall(node) {
      return (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'MemberExpression' &&
        node.callee.object.object.name === 'logger' &&
        node.callee.object.property.name === 'once' &&
        ['debug', 'info', 'warn', 'error', 'trace', 'fatal'].includes(
          node.callee.property.name,
        )
      );
    }

    function isSimpleLoggerCall(node) {
      return (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'logger' &&
        ['debug', 'info', 'warn', 'error', 'trace', 'fatal'].includes(
          node.callee.property.name,
        )
      );
    }

    /**
     * Check if a property key is 'repo' (handles both shorthand and key-value)
     */
    function isRepoProperty(property) {
      if (property.type !== 'Property') {
        return false;
      }

      // Shorthand property: { repo }
      if (property.shorthand && property.key.name === 'repo') {
        return true;
      }

      // Regular property: { repo: value } or { "repo": value }
      if (property.key.type === 'Identifier' && property.key.name === 'repo') {
        return true;
      }

      if (
        property.key.type === 'Literal' &&
        property.key.value === 'repo'
      ) {
        return true;
      }

      return false;
    }

    /**
     * Check if this is a compound property like 'repositoryDetails: repo'
     * or 'gitlabRepo: repo' where the value is 'repo' but the key is different
     */
    function isRepoValue(property) {
      return (
        property.type === 'Property' &&
        !property.shorthand &&
        property.value.type === 'Identifier' &&
        property.value.name === 'repo' &&
        property.key.name !== 'repo'
      );
    }

    return {
      CallExpression(node) {
        // Check if this is a logger call
        if (!isLoggerCall(node) && !isSimpleLoggerCall(node)) {
          return;
        }

        // Check if the first argument is an object
        if (node.arguments.length === 0) {
          return;
        }

        const firstArg = node.arguments[0];
        if (firstArg.type !== 'ObjectExpression') {
          return;
        }

        // Check each property in the object
        for (const property of firstArg.properties) {
          if (isRepoProperty(property)) {
            context.report({
              node: property.key,
              messageId: 'useRepository',
              fix(fixer) {
                // For shorthand properties: { repo } -> { repository }
                if (property.shorthand) {
                  return fixer.replaceText(property, 'repository');
                }
                // For key-value: { repo: value } -> { repository: value }
                return fixer.replaceText(property.key, 'repository');
              },
            });
          }

          // Don't flag cases like { repositoryDetails: repo } or { gitlabRepo: repo }
          // These are acceptable as they're renaming a variable
          if (isRepoValue(property)) {
            // This is OK - it's like { repositoryDetails: repo }
            continue;
          }
        }
      },
    };
  },
};
