import enforceTsExtension from './rules/enforce-ts-extension.js';
import noHardcodedDocsUrl from './rules/no-hardcoded-docs-url.js';
import noNewUrl from './rules/no-new-url.js';
import noToolsImport from './rules/no-tools-import.js';
import testRootDescribe from './rules/test-root-describe.js';
import v8IgnoreReason from './rules/v8-ignore-reason.js';
import zodSchemaNaming from './rules/zod-schema-naming.js';

export default {
  meta: {
    name: 'renovate',
  },
  rules: {
    'enforce-ts-extension': enforceTsExtension,
    'no-hardcoded-docs-url': noHardcodedDocsUrl,
    'no-new-url': noNewUrl,
    'no-tools-import': noToolsImport,
    'test-root-describe': testRootDescribe,
    'v8-ignore-reason': v8IgnoreReason,
    'zod-schema-naming': zodSchemaNaming,
  },
};
