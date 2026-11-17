import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-nullish-util.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-nullish-util', rule, {
  valid: [
    // the recommended helpers
    `Nullish(z.string());`,
    `DeepNullish(Schema);`,
    // single modifiers are fine
    `z.string().optional();`,
    `z.string().nullable();`,
    `z.optional(z.string());`,
    `z.nullable(z.string());`,
    // same modifier twice is not the flagged combination
    `z.string().optional().optional();`,
    `z.string().nullable().nullable();`,
    // callee is not a member expression
    `nullish();`,
    `optional(nullable(x));`,
    // computed member calls are ignored
    `z['nullish']();`,
    `z.string()['optional']();`,
    // more than one argument, and a receiver that is not a matching call
    `z.optional(a, b);`,
    `z.optional(x);`,
  ],
  invalid: [
    {
      code: `z.string().nullish();`,
      errors: [{ messageId: 'noNullish' }],
    },
    {
      code: `z.nullish(z.string());`,
      errors: [{ messageId: 'noNullish' }],
    },
    // chained
    {
      code: `z.string().nullable().optional();`,
      errors: [{ messageId: 'noChain' }],
    },
    {
      code: `z.string().optional().nullable();`,
      errors: [{ messageId: 'noChain' }],
    },
    // nested standalone
    {
      code: `z.optional(z.nullable(x));`,
      errors: [{ messageId: 'noChain' }],
    },
    {
      code: `z.nullable(z.optional(x));`,
      errors: [{ messageId: 'noChain' }],
    },
  ],
});
