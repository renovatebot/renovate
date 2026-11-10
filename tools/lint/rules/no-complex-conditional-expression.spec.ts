import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-complex-conditional-expression.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-complex-conditional-expression', rule, {
  valid: [
    // logical expressions in a ternary test are evaluated unconditionally
    `const x = a && b ? c : d;`,
    `const x = a ? b && c : d;`,
    // ternaries nested deeper than a direct operand
    `const x = a && foo(b ? c : d);`,
    // await in positions that always run
    `async function f() { const x = (await a) ? b : c; }`,
    `async function f() { const x = (await a) && b; }`,
    `async function f() { const x = await (a ? b : c); }`,
    `async function f() { if (a) { await b; } }`,
    // a nested function starts a new evaluation context
    `const x = a ? async () => { await b; } : c;`,
    `const x = a && (async () => await b);`,
    `const x = a ?? async function () { await b; };`,
  ],
  invalid: [
    {
      code: `const x = a && (b ? c : d);`,
      errors: [{ messageId: 'ternaryInLogical', data: { operator: '&&' } }],
    },
    {
      code: `const x = (a ? b : c) || d;`,
      errors: [{ messageId: 'ternaryInLogical', data: { operator: '||' } }],
    },
    {
      code: `const x = a ?? ((b ? c : d) as string);`,
      errors: [{ messageId: 'ternaryInLogical', data: { operator: '??' } }],
    },
    {
      code: `async function f() { return a ? await b : c; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a ? b : await c; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a && (await b); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a || foo(await b); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { if (a ?? (await b)!.c) { return; } }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      // the shape from PR #47803
      code: `async function f() { return a.length > 0 && b.every((x) => x) ? await c() : null; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
  ],
});
