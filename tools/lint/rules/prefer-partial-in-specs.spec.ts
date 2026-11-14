import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-partial-in-specs.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-partial-in-specs', rule, {
  valid: [
    // `as const` narrows instead of bypassing type checking
    `const config = { foo: 'bar' } as const;`,
    // casting a non-object-literal is not the pattern being banned
    `const config = value as Config;`,
    `const config = [] as Config[];`,
    `const config = null as unknown as Config;`,
    // properly typed object literal without a cast
    `const config: Config = { foo: 'bar' };`,
    // partial<T>() is the recommended replacement
    `const config = partial<Config>({ foo: 'bar' });`,
  ],
  invalid: [
    {
      code: `const config = { foo: 'bar' } as Config;`,
      errors: [{ messageId: 'preferPartial' }],
    },
    {
      code: `const config = {} as Config;`,
      errors: [{ messageId: 'preferPartial' }],
    },
    {
      code: `const config = {} as any;`,
      errors: [{ messageId: 'preferPartial' }],
    },
    // qualified type name is not a `const` assertion
    {
      code: `const config = {} as ns.Config;`,
      errors: [{ messageId: 'preferPartial' }],
    },
    {
      code: `fn({ foo: 'bar' } as Config);`,
      errors: [{ messageId: 'preferPartial' }],
    },
  ],
});
