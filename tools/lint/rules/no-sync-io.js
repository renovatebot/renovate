/**
 * Fixed list of Node.js synchronous I/O APIs to flag. Matching is done against
 * this exact list (not arbitrary `*Sync` names) to avoid false positives on
 * non-Node APIs that happen to end in `Sync`.
 */
const SYNC_IO_NAMES = new Set([
  'readFileSync',
  'writeFileSync',
  'mkdirSync',
  'rmSync',
  'readdirSync',
  'statSync',
  'existsSync',
  'copyFileSync',
  'execSync',
  'spawnSync',
  'execFileSync',
]);

/**
 * Extract the called function's name from a callee expression, either a bare
 * identifier (`readFileSync(...)`) or the property of a member expression
 * (`fs.readFileSync(...)`).
 * @param {import('estree').Expression | import('estree').Super} callee
 * @returns {string | null}
 */
function getCalleeName(callee) {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      noSyncIo:
        'Use async I/O; top-level await is available (ESM). See best-practices.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = getCalleeName(node.callee);
        if (name && SYNC_IO_NAMES.has(name)) {
          context.report({ node, messageId: 'noSyncIo' });
        }
      },
    };
  },
};
