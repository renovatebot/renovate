import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-new-url.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-new-url', rule, {
  valid: [
    // parseUrl cannot express a base, so two-argument calls are allowed
    `new URL('/foo', base);`,
    // no arguments
    `new URL();`,
    // other constructors
    `new URLSearchParams('a=b');`,
    // member expression callee
    `new global.URL('https://example.com');`,
    // plain call, not a construction
    `URL('https://example.com');`,
  ],
  invalid: [
    {
      code: `new URL('https://example.com');`,
      errors: [{ messageId: 'noNewUrl' }],
    },
    {
      code: `const url = new URL(someString);`,
      errors: [{ messageId: 'noNewUrl' }],
    },
  ],
});
