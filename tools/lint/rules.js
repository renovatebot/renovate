import codeblockInSpecFixtures from './rules/codeblock-in-spec-fixtures.js';
import enforceTsExtension from './rules/enforce-ts-extension.js';
import loggerStaticMessage from './rules/logger-static-message.js';
import noHardcodedDocsUrl from './rules/no-hardcoded-docs-url.js';
import noHostRulesMock from './rules/no-host-rules-mock.js';
import noNewUrl from './rules/no-new-url.js';
import noRedundantMockReset from './rules/no-redundant-mock-reset.js';
import noStatefulGlobalRegex from './rules/no-stateful-global-regex.js';
import noToolsImport from './rules/no-tools-import.js';
import preferFakeShaInSpecs from './rules/prefer-fake-sha-in-specs.js';
import preferNullishUtil from './rules/prefer-nullish-util.js';
import preferPartialInSpecs from './rules/prefer-partial-in-specs.js';
import testRootDescribe from './rules/test-root-describe.js';
import v8IgnoreReason from './rules/v8-ignore-reason.js';
import zodSchemaNaming from './rules/zod-schema-naming.js';

export default {
  meta: {
    name: 'renovate',
  },
  rules: {
    'codeblock-in-spec-fixtures': codeblockInSpecFixtures,
    'enforce-ts-extension': enforceTsExtension,
    'logger-static-message': loggerStaticMessage,
    'no-hardcoded-docs-url': noHardcodedDocsUrl,
    'no-host-rules-mock': noHostRulesMock,
    'no-new-url': noNewUrl,
    'no-redundant-mock-reset': noRedundantMockReset,
    'no-stateful-global-regex': noStatefulGlobalRegex,
    'no-tools-import': noToolsImport,
    'prefer-fake-sha-in-specs': preferFakeShaInSpecs,
    'prefer-nullish-util': preferNullishUtil,
    'prefer-partial-in-specs': preferPartialInSpecs,
    'test-root-describe': testRootDescribe,
    'v8-ignore-reason': v8IgnoreReason,
    'zod-schema-naming': zodSchemaNaming,
  },
};
