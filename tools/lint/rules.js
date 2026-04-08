import enforceTsExtension from './rules/enforce-ts-extension.js';
import noToolsImport from './rules/no-tools-import.js';
import testRootDescribe from './rules/test-root-describe.js';

export default {
  meta: {
    name: 'renovate',
  },
  rules: {
    'enforce-ts-extension': enforceTsExtension,
    'no-tools-import': noToolsImport,
    'test-root-describe': testRootDescribe,
  },
};
