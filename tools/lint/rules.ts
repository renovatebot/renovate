import { definePlugin } from '@oxlint/plugins';
import codeblockInSpecFixtures from './rules/codeblock-in-spec-fixtures.ts';
import enforceTsExtension from './rules/enforce-ts-extension.ts';
import loggerStaticMessage from './rules/logger-static-message.ts';
import noExecShellOption from './rules/no-exec-shell-option.ts';
import noHardcodedDocsUrl from './rules/no-hardcoded-docs-url.ts';
import noHostRulesMock from './rules/no-host-rules-mock.ts';
import noNewUrl from './rules/no-new-url.ts';
import noNumberConstructor from './rules/no-number-constructor.ts';
import noRedundantMockReset from './rules/no-redundant-mock-reset.ts';
import noStatefulGlobalRegex from './rules/no-stateful-global-regex.ts';
import noToolsImport from './rules/no-tools-import.ts';
import noUnquotedExecInterpolation from './rules/no-unquoted-exec-interpolation.ts';
import noUnvalidatedPaginationUrl from './rules/no-unvalidated-pagination-url.ts';
import preferFakeShaInSpecs from './rules/prefer-fake-sha-in-specs.ts';
import preferFsUtil from './rules/prefer-fs-util.ts';
import preferIsHelpers from './rules/prefer-is-helpers.ts';
import preferIsObject from './rules/prefer-is-object.ts';
import preferJsonPipe from './rules/prefer-json-pipe.ts';
import preferLuxon from './rules/prefer-luxon.ts';
import preferNullishUtil from './rules/prefer-nullish-util.ts';
import preferPartialInSpecs from './rules/prefer-partial-in-specs.ts';
import requireRegexUtil from './rules/require-regex-util.ts';
import testRootDescribe from './rules/test-root-describe.ts';
import v8IgnoreNoCount from './rules/v8-ignore-no-count.ts';
import v8IgnoreReason from './rules/v8-ignore-reason.ts';
import validateConfigWarningsAndErrors from './rules/validate-config-warnings-and-errors.ts';
import zodSchemaLocation from './rules/zod-schema-location.ts';
import zodSchemaNaming from './rules/zod-schema-naming.ts';

export default definePlugin({
  meta: {
    name: 'renovate',
  },
  rules: {
    'codeblock-in-spec-fixtures': codeblockInSpecFixtures,
    'enforce-ts-extension': enforceTsExtension,
    'logger-static-message': loggerStaticMessage,
    'no-exec-shell-option': noExecShellOption,
    'no-hardcoded-docs-url': noHardcodedDocsUrl,
    'no-host-rules-mock': noHostRulesMock,
    'no-new-url': noNewUrl,
    'no-number-constructor': noNumberConstructor,
    'no-redundant-mock-reset': noRedundantMockReset,
    'no-stateful-global-regex': noStatefulGlobalRegex,
    'no-tools-import': noToolsImport,
    'no-unquoted-exec-interpolation': noUnquotedExecInterpolation,
    'no-unvalidated-pagination-url': noUnvalidatedPaginationUrl,
    'prefer-fake-sha-in-specs': preferFakeShaInSpecs,
    'prefer-fs-util': preferFsUtil,
    'prefer-json-pipe': preferJsonPipe,
    'prefer-luxon': preferLuxon,
    'prefer-is-helpers': preferIsHelpers,
    'prefer-is-object': preferIsObject,
    'prefer-nullish-util': preferNullishUtil,
    'prefer-partial-in-specs': preferPartialInSpecs,
    'require-regex-util': requireRegexUtil,
    'test-root-describe': testRootDescribe,
    'v8-ignore-no-count': v8IgnoreNoCount,
    'v8-ignore-reason': v8IgnoreReason,
    'validate-config-warnings-and-errors': validateConfigWarningsAndErrors,
    'zod-schema-location': zodSchemaLocation,
    'zod-schema-naming': zodSchemaNaming,
  },
});
