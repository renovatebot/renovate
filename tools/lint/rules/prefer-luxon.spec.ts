import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-luxon.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-luxon', rule, {
  valid: [
    // `Date.now()` is deliberately not flagged
    `Date.now();`,
    `DateTime.utc();`,
    `new DateTime();`,
    // member callees are not flagged
    `new foo.Date();`,
    // a call, not a construction
    `Date();`,
  ],
  invalid: [
    {
      code: `new Date();`,
      errors: [{ messageId: 'preferLuxon' }],
    },
    {
      code: `new Date(2020, 1, 1);`,
      errors: [{ messageId: 'preferLuxon' }],
    },
    {
      code: `const d = new Date(Date.now());`,
      errors: [{ messageId: 'preferLuxon' }],
    },
  ],
});
