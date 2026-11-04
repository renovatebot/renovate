import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-number-constructor.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-number-constructor', rule, {
  valid: [
    `parseInt('42', 10);`,
    // other globals with a similar name are unaffected
    `NumberFormat('42');`,
    // member expression callee, e.g. Number.isNaN, Number.parseInt
    `Number.isNaN(value);`,
    `Number.parseInt('42', 10);`,
  ],
  invalid: [
    {
      code: `Number('42');`,
      errors: [{ messageId: 'noNumberConstructor' }],
    },
    {
      code: `const x = Number(someString);`,
      errors: [{ messageId: 'noNumberConstructor' }],
    },
    {
      code: `new Number('42');`,
      errors: [{ messageId: 'noNumberConstructor' }],
    },
  ],
});
