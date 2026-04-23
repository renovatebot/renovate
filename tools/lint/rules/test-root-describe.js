/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    fixable: 'code',
  },
  create(context) {
    const absoluteFileName = context.filename;
    if (!absoluteFileName.endsWith('.spec.ts')) {
      return {};
    }
    const relativeFileName = absoluteFileName
      .replace(context.cwd, '')
      .replace(/\\/g, '/')
      .replace(/^(?:\/(?:lib|src|test))?\//, '');
    const testName = relativeFileName.replace(/\.spec\.ts$/, '');
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'Identifier' || callee.name !== 'describe') {
          return;
        }
        if (node.parent?.parent?.type !== 'Program') {
          return;
        }

        const [descr] = node.arguments;
        if (!descr) {
          context.report({
            node,
            message: 'Test root describe must have arguments',
          });
          return;
        }

        if (
          descr.type === 'Literal' &&
          typeof descr.value === 'string' &&
          testName === descr.value
        ) {
          return;
        }

        context.report({
          node: descr,
          message: `Test must be described by this string: '${testName}'`,
          fix(fixer) {
            return fixer.replaceText(descr, `'${testName}'`);
          },
        });
      },
    };
  },
};
