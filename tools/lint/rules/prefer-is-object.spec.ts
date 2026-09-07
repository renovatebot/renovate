import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-is-object.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-is-object', rule, {
  valid: [
    // already using the helper
    `is.plainObject(x);`,
    // other typeof comparisons
    `typeof x === 'string';`,
    `typeof x !== 'function';`,
    // non-equality operators
    `typeof x + 'object';`,
    `typeof x > 'object';`,
    // literal without typeof
    `x === 'object';`,
    // typeof compared to a non-literal
    `typeof x === y;`,
    // unary operator other than typeof
    `-x === 'object';`,
    // neither side is a string literal
    `typeof x === typeof y;`,
  ],
  invalid: [
    {
      code: `typeof x === 'object';`,
      errors: [{ messageId: 'preferIsObject' }],
    },
    {
      code: `typeof x !== 'object';`,
      errors: [{ messageId: 'preferIsObject' }],
    },
    {
      code: `typeof x == 'object';`,
      errors: [{ messageId: 'preferIsObject' }],
    },
    {
      code: `typeof x != 'object';`,
      errors: [{ messageId: 'preferIsObject' }],
    },
    // reversed operand order
    {
      code: `'object' === typeof x;`,
      errors: [{ messageId: 'preferIsObject' }],
    },
    // member expression operand
    {
      code: `typeof foo.bar === 'object';`,
      errors: [{ messageId: 'preferIsObject' }],
    },
  ],
});
