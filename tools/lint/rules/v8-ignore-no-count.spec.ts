import { RuleTester } from 'oxlint/plugins-dev';
import rule from './v8-ignore-no-count.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('v8-ignore-no-count', rule, {
  valid: [
    // no coverage-ignore comment at all
    `/* just a comment */ const a = 1;`,
    `// TODO: something\nconst a = 1;`,
    // keyword-only forms
    `/* v8 ignore next -- should never happen */\nconst a = 1;`,
    `// v8 ignore next -- should never happen\nconst a = 1;`,
    `/* v8 ignore if -- platform specific */\nconst a = 1;`,
    `/* v8 ignore else -- platform specific */\nconst a = 1;`,
    `/* v8 ignore file -- generated */\nconst a = 1;`,
    `/* v8 ignore start -- covered elsewhere */\nconst a = 1;`,
    `/* v8 ignore stop */\nconst a = 1;`,
  ],
  invalid: [
    {
      code: `/* v8 ignore next 3 -- hard to test */\nconst a = 1;`,
      output: `/* v8 ignore next -- hard to test */\nconst a = 1;`,
      errors: [{ messageId: 'noCount' }],
    },
    {
      code: `/* v8 ignore next 12 */\nconst a = 1;`,
      output: `/* v8 ignore next */\nconst a = 1;`,
      errors: [{ messageId: 'noCount' }],
    },
    {
      code: `// v8 ignore next 2 -- should never happen\nconst a = 1;`,
      output: `// v8 ignore next -- should never happen\nconst a = 1;`,
      errors: [{ messageId: 'noCount' }],
    },
    {
      code: `/* v8 ignore next 3: hard to test */\nconst a = 1;`,
      output: `/* v8 ignore next: hard to test */\nconst a = 1;`,
      errors: [{ messageId: 'noCount' }],
    },
  ],
});
