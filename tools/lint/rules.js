// @ts-nocheck
const TOOLS_IMPORT_PATTERN = /(?:^|\/|\.\.\/)tools\//;
const CWD = process.cwd();

module.exports = {
  meta: {
    name: 'renovate',
  },
  rules: {
    'no-tools-import': {
      meta: {
        type: 'problem',
        messages: {
          noToolsImport: 'Importing from tools/ is not allowed in lib/',
        },
      },
      create(context) {
        const filename = context.filename ?? context.physicalFilename ?? '';
        if (!filename.includes('/lib/')) {
          return {};
        }

        return {
          ImportDeclaration(node) {
            if (TOOLS_IMPORT_PATTERN.test(node.source.value)) {
              context.report({ node: node.source, messageId: 'noToolsImport' });
            }
          },
        };
      },
    },
    'test-root-describe': {
      meta: {
        fixable: 'code',
      },
      create(context) {
        const absoluteFileName = context.filename;
        if (!absoluteFileName.endsWith('.spec.ts')) {
          return {};
        }
        const relativeFileName = absoluteFileName
          .replace(CWD, '')
          .replace(/\\/g, '/')
          .replace(/^(?:\/(?:lib|src|test))?\//, '');
        const testName = relativeFileName.replace(/\.spec\.ts$/, '');
        return {
          CallExpression(node) {
            const { callee } = node;
            if (
              callee.type === 'Identifier' &&
              callee.name === 'describe' &&
              node.parent.parent.type === 'Program'
            ) {
              const [descr] = node.arguments;

              if (!descr) {
                context.report({
                  node,
                  message: `Test root describe must have arguments`,
                });
                return;
              }

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
