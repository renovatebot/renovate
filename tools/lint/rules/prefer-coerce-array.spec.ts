import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-coerce-array.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-coerce-array', rule, {
  valid: [
    // already using the helper
    `const a = coerceArray(x);`,
    // non-empty default
    `const a = x ?? [1];`,
    // asserted default is not a bare array literal
    `const a = x ?? ([] as string[]);`,
    // object default belongs to `prefer-coerce-object`
    `const a = x ?? {};`,
    // other logical operators
    `const a = x || [];`,
    `const a = x && [];`,
    // assignment rather than a logical expression
    `x ??= [];`,
    // destructuring and parameter defaults have no helper form
    `const { a = [] } = obj;`,
    `function f(a = []) {}`,
    // empty array unrelated to a nullish default
    `const a = [];`,
  ],
  invalid: [
    {
      code: `const a = x ?? [];`,
      errors: [{ messageId: 'preferCoerceArray' }],
    },
    // optional chaining operand
    {
      code: `const a = x?.y ?? [];`,
      errors: [{ messageId: 'preferCoerceArray' }],
    },
    // call expression operand
    {
      code: `for (const f of getFiles() ?? []) {}`,
      errors: [{ messageId: 'preferCoerceArray' }],
    },
    // chained nullish defaults report once, on the outer expression
    {
      code: `const a = x ?? y ?? [];`,
      errors: [{ messageId: 'preferCoerceArray' }],
    },
  ],
});
