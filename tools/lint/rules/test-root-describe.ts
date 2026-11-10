import { defineRule } from '@oxlint/plugins';

export default defineRule({
  meta: {
    fixable: 'code',
  },
  createOnce(context) {
    let testName = '';
    return {
      before() {
        const absoluteFileName = context.filename;
        if (!absoluteFileName.endsWith('.spec.ts')) {
          return false;
        }
        const relativeFileName = absoluteFileName
          .replace(context.cwd, '')
          .replace(/\\/g, '/')
          .replace(/^(?:\/(?:lib|src|test))?\//, '');
        testName = relativeFileName.replace(/\.spec\.ts$/, '');
      },
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
});
