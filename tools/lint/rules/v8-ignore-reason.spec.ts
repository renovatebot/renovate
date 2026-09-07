import { RuleTester } from 'oxlint/plugins-dev';
import rule from './v8-ignore-reason.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('v8-ignore-reason', rule, {
  valid: [
    // no coverage-ignore comment at all
    `/* just a comment */ const a = 1;`,
    `// TODO: something\nconst a = 1;`,
    // dash form with a reason
    `/* v8 ignore next -- should never happen */\nconst a = 1;`,
    `/* v8 ignore next 3 -- hard to test */\nconst a = 1;`,
    `/* v8 ignore start --- covered elsewhere */\nconst a = 1;`,
    `// v8 ignore next -- should never happen\nconst a = 1;`,
    // legacy colon form with a reason
    `/* v8 ignore next: hard to test */\nconst a = 1;`,
    `/* v8 ignore next 3: hard to test */\nconst a = 1;`,
    `/* v8 ignore file: generated */\nconst a = 1;`,
    // bare stop closes a region whose justification lives on `start`
    `/* v8 ignore stop */\nconst a = 1;`,
    `/*  v8 ignore stop  */\nconst a = 1;`,
  ],
  invalid: [
    {
      code: `/* v8 ignore next */\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }],
    },
    {
      code: `/* v8 ignore next 3 */\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }],
    },
    {
      code: `/* v8 ignore start */\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }],
    },
    {
      code: `// v8 ignore next\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }],
    },
    // dash separator without a reason after it
    {
      code: `/* v8 ignore next -- */\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }],
    },
    // colon without a reason after it
    {
      code: `/* v8 ignore next: */\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }],
    },
    // `stop` with trailing content is not a bare stop
    {
      code: `/* v8 ignore stop here */\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }],
    },
    {
      code: `/* v8 ignore next */\n/* v8 ignore start */\nconst a = 1;`,
      errors: [{ messageId: 'missingReason' }, { messageId: 'missingReason' }],
    },
  ],
});
