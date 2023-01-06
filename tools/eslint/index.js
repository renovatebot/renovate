module.exports = {
  rules: {
    'jest-root-describe': {
      meta: {
        fixable: 'code',
      },
      /**
       * @param {{ getFilename: () => any; report: (arg0: { node: any; message: string; fix(fixer: any): any; }) => void; }} context
       */
      create(context) {
        const absoluteFileName = context.getFilename();
        if (!absoluteFileName.endsWith('.spec.ts')) {
          return {};
        }
        const relativeFileName = absoluteFileName
          .replace(process.cwd(), '')
          .replace(/\\/g, '/')
          .replace(/^(?:\/(?:lib|src|test))?\//, '');
        const testName = String(relativeFileName.replace(/\.spec\.ts$/, ''));
        return {
          /**
           * @param {{ parent?: any; arguments?: any; callee?: any; }} node
           */
          CallExpression(node) {
            const { callee } = node;
            if (
              callee.type === 'Identifier' &&
              callee.name === 'describe' &&
              node.parent.parent.type === 'Program'
            ) {
              const [descr] = node.arguments;
              const isOkay =
                descr.type === 'Literal' &&
                typeof descr.value === 'string' &&
                testName === descr.value;
              if (!isOkay) {
                context.report({
                  node: descr,
                  message: `Test must be described by this string: '${testName}'`,
                  fix(fixer) {
                    return fixer.replaceText(descr, `'${testName}'`);
                  },
                });
              }
            }
          },
        };
      },
    },
  },
};
