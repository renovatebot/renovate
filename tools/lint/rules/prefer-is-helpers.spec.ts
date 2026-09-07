import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-is-helpers.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-is-helpers', rule, {
  valid: [
    // --- filter(Boolean) ---
    `arr.filter(isTruthy);`,
    `arr.map(Boolean);`,
    `filter(Boolean);`,
    `arr['filter'](Boolean);`,
    `arr.filter(Boolean, thisArg);`,
    `arr.filter();`,

    // --- typeof string ---
    `is.string(x);`,
    // `isNumber()` also excludes `NaN`, so this isn't a safe rewrite
    `typeof x === 'number';`,
    // `isObject()` excludes `null` and includes functions, so this isn't a
    // safe rewrite
    `typeof x === 'object';`,
    `x === 'string';`,
    // `+` is not a comparison operator
    `typeof x + 'string';`,
    `typeof x === y;`,
    // unary operator other than typeof
    `-x === 'string';`,

    // --- null/undefined comparisons ---
    `isNullOrUndefined(x);`,
    // only one of the two nullish values
    `x === null || x === false;`,
    // same nullish value twice
    `x === null || x === null;`,
    `x === undefined || x === undefined;`,
    // mismatched operator kind for the logical operator
    `x === null && x === undefined;`,
    `x !== null || x !== undefined;`,
    // non-logical / other logical operators
    `x ?? y;`,
    // different references
    `x === null || y === undefined;`,
    `a.b === null || a.c === undefined;`,
    // computed vs non-computed member access
    `a.b === null || a['b'] === undefined;`,
    // computed with non-literal keys is not a simple reference
    `a[k] === null || a[k] === undefined;`,
    // computed literal keys that differ
    `a['b'] === null || a['c'] === undefined;`,
    // node types differ
    `x === null || this === undefined;`,
    // calls may have side effects and are never "same refs"
    `foo() === null || foo() === undefined;`,
    // operand is not a comparison at all
    `foo() || x === undefined;`,
    `x === null || foo();`,
    // member object differs
    `a.c === null || b.c === undefined;`,
  ],
  invalid: [
    // --- filter(Boolean) ---
    {
      code: `arr.filter(Boolean);`,
      errors: [{ messageId: 'preferIsTruthy' }],
    },
    {
      code: `foo.bar().filter(Boolean);`,
      errors: [{ messageId: 'preferIsTruthy' }],
    },

    // --- typeof string ---
    {
      code: `typeof x === 'string';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof x !== 'string';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof x == 'string';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof x != 'string';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    // reversed operand order
    {
      code: `'string' === typeof x;`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },

    // --- typeof boolean/function/symbol/bigint/undefined ---
    {
      code: `typeof x === 'boolean';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof fn === 'function';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof x === 'symbol';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof x === 'bigint';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof x === 'undefined';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },
    {
      code: `typeof x !== 'undefined';`,
      errors: [{ messageId: 'preferIsHelperForTypeof' }],
    },

    // --- null/undefined comparisons ---
    {
      code: `x === null || x === undefined;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
    {
      code: `x == null || x == undefined;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
    {
      code: `x === undefined || x === null;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
    // reversed operand order within each comparison
    {
      code: `null === x || undefined === x;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
    {
      code: `x !== null && x !== undefined;`,
      errors: [{ messageId: 'preferNotIsNullOrUndefined' }],
    },
    {
      code: `x != null && x != undefined;`,
      errors: [{ messageId: 'preferNotIsNullOrUndefined' }],
    },
    // `this` as the reference
    {
      code: `this === null || this === undefined;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
    // non-computed member reference
    {
      code: `a.b === null || a.b === undefined;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
    // nested member reference
    {
      code: `a.b.c !== null && a.b.c !== undefined;`,
      errors: [{ messageId: 'preferNotIsNullOrUndefined' }],
    },
    // computed member reference with matching literal keys
    {
      code: `a['b'] === null || a['b'] === undefined;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
    // optional chains unwrap to the same reference
    {
      code: `a?.b === null || a?.b === undefined;`,
      errors: [{ messageId: 'preferIsNullOrUndefined' }],
    },
  ],
});
