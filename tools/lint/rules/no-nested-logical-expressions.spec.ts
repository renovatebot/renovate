import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-nested-logical-expressions.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

const deep = `x = isPinned(dep) && (!configDays || (!!dep.releaseTimestamp && getElapsed(dep) >= limit));`;

ruleTester.run('no-nested-logical-expressions', rule, {
  valid: [
    `x = a && b && c && d;`,
    `x = a || b || c;`,
    `x = a && (b || c);`,
    `x = a && (b && c);`,
    `x = (a || b) && (c || d);`,
    `x = a ?? b ?? c;`,
    `x = a && foo(b && c);`,
    `x = a && foo(() => { return b || (c && d); });`,
    `x = a && foo(function () { return b || c; });`,
    `foo(a || (b && c));`,
    `x = a && foo(bar).baz;`,
    `x = a && foo(b || c).x;`,
    `x = a && (() => b || c)();`,
    `x = a && (b || c)(d);`,
    `x = a && foo(...(b || c));`,
    `x = a && foo[b || (c && d)];`,
    `x = !a && b;`,
    `x = a && (b as boolean);`,
    { code: deep, options: [{ max: 3 }] },
    { code: `x = a && (b || (c && (d || e)));`, options: [{ max: 4 }] },
  ],
  invalid: [
    {
      code: `x = a && foo(b.x || (c && d).y);`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (() => b || (c && d))();`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (b || (c && d))(e);`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(...(b || (c && d)));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (b || (c && d)).y;`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(b && (c || (d && e))).x;`,
      errors: [{ messageId: 'tooDeep', data: { depth: '4', max: '2' } }],
    },
    {
      code: `x = a && foo(() => { return b && (c || (d && e)); });`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (b && (c || (d && e)))(f);`,
      errors: [{ messageId: 'tooDeep', data: { depth: '4', max: '2' } }],
    },
    {
      code: `x = a ?? (b && (c || d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (b ?? (c || d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && items.some((i) => i.x || (i.y && i.z));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo?.(b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo?.bar(b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && items.filter((i) => i.x || (i.y && i.z)).some((j) => j);`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && new Foo(b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && !foo(b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (foo(b || (c && d)) as boolean);`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(bar(b || (c && d)));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(() => b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo((i) => !(i.x || (i.y && i.z)));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(() => { return 1; }, b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(b)(c || (d && e));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(c || (d && e)!)!.bar();`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && foo(b || c);`,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooDeep', data: { depth: '2', max: '1' } }],
    },
    {
      code: `x = a ?? foo(b || c);`,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooDeep', data: { depth: '2', max: '1' } }],
    },
    {
      code: deep,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && !(b || (c && d));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (b || c!) && (d || (e && f));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && ((b || (c && d)) as boolean);`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a ?? (b && (c || (d && e)));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '4', max: '2' } }],
    },
    {
      code: `x = foo(a && (b || (c && d)));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '3', max: '2' } }],
    },
    {
      code: `x = a && (b || c);`,
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooDeep', data: { depth: '2', max: '1' } }],
    },
    {
      code: `x = a && (b || (c && (d || e)));`,
      options: [{ max: 3 }],
      errors: [{ messageId: 'tooDeep', data: { depth: '4', max: '3' } }],
    },
    {
      code: `x = a && (b || (c && (d || e)));`,
      errors: [{ messageId: 'tooDeep', data: { depth: '4', max: '2' } }],
    },
  ],
});
