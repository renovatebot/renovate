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
    // plain and arithmetic assignments are not logical operators
    `x = a ? b : c;`,
    `x += a ? b : c;`,
    // await in positions that always run
    `async function f() { const x = (await a) ? b : c; }`,
    `async function f() { const x = (await a) && b; }`,
    `async function f() { const x = await (a ? b : c); }`,
    `async function f() { if (a) { await b; } }`,
    `async function f() { x = await a; }`,
    `async function f() { x += await a; }`,
    // optional links after the await, or before it only in the object
    `async function f() { return foo(await a)?.b; }`,
    `async function f() { return (await a)?.b(c); }`,
    `async function f() { return a.b(await c); }`,
    `async function f() { return a[await k]; }`,
    `async function f() { const { v } = await o; }`,
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
      code: `x ??= a || b ? c : undefined;`,
      errors: [{ messageId: 'ternaryInLogical', data: { operator: '??=' } }],
    },
    {
      code: `x ||= (a ? b : c)!;`,
      errors: [{ messageId: 'ternaryInLogical', data: { operator: '||=' } }],
    },
    {
      code: `x &&= a ? b : c;`,
      errors: [{ messageId: 'ternaryInLogical', data: { operator: '&&=' } }],
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
      code: `async function f() { x ??= await y; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { x ||= await y; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { x &&= foo(await y); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a ? ((await b) satisfies T) : c; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a ?? ((await b) as T); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      // reported once, even though two branches enclose it
      code: `async function f() { return a ? b : c ? await d : e; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a?.b(await c); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a?.b.c(await d); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a!?.b!.c(await d); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a.b?.(await c); }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { return a?.[await k]; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { const { v = await d } = o; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      code: `async function f() { const [v = await d] = o; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
    {
      // the shape from PR #47803
      code: `async function f() { return a.length > 0 && b.every((x) => x) ? await c() : null; }`,
      errors: [{ messageId: 'conditionalAwait' }],
    },
  ],
});
