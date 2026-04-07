import noToolsImport from './rules/no-tools-import.js';
import testRootDescribe from './rules/test-root-describe.js';

/** @type {import('eslint').ESLint.Plugin} */
export default {
  meta: {
    name: 'renovate',
  },
  rules: {
    'no-tools-import': noToolsImport,
    'test-root-describe': testRootDescribe,
  },
};
