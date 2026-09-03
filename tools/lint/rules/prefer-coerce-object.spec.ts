import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-coerce-object.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-coerce-object', rule, {
  valid: [
    // already using the helper
    `const a = coerceObject(x);`,
    // non-empty default
    `const a = x ?? { a: 1 };`,
    // asserted default is not a bare object literal
    `const a = x ?? ({} as Foo);`,
    // array default belongs to `prefer-coerce-array`
    `const a = x ?? [];`,
    // other logical operators
    `const a = x || {};`,
    `const a = x && {};`,
    // assignment rather than a logical expression
    `x ??= {};`,
    // destructuring and parameter defaults have no helper form
    `const { a = {} } = obj;`,
    `function f(a = {}) {}`,
    // empty object unrelated to a nullish default
    `const a = {};`,
  ],
  invalid: [
    {
      code: `const a = x ?? {};`,
      errors: [{ messageId: 'preferCoerceObject' }],
    },
    // optional chaining operand
    {
      code: `const a = x?.y ?? {};`,
      errors: [{ messageId: 'preferCoerceObject' }],
    },
    // call expression operand
    {
      code: `hasLockedUpdate(config, parse().workflows ?? {});`,
      errors: [{ messageId: 'preferCoerceObject' }],
    },
    // chained nullish defaults report once, on the outer expression
    {
      code: `const a = x ?? y ?? {};`,
      errors: [{ messageId: 'preferCoerceObject' }],
    },
  ],
});
