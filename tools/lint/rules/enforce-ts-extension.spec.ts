import { RuleTester } from 'oxlint/plugins-dev';
import rule from './enforce-ts-extension.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('enforce-ts-extension', rule, {
  valid: [
    // already using .ts
    `import { foo } from './foo.ts';`,
    `export { foo } from './foo.ts';`,
    `export * from './foo.ts';`,
    `void import('./foo.ts');`,
    `vi.mock('./foo.ts');`,
    `vi.mock('~/util/foo.ts');`,
    // bare package specifiers are not local paths
    `import { foo } from 'lodash';`,
    `import { foo } from 'some/pkg.js';`,
    `vi.mock('lodash');`,
    // local imports without extension are only enforced for vi.* helpers
    `import { foo } from './foo';`,
    // re-export without a source
    `export const foo = 1;`,
    // non-literal dynamic import
    `void import(specifier);`,
    // non-literal vi.mock argument
    `vi.mock(specifier);`,
    // non-string literal argument
    `vi.mock(42);`,
    // no argument
    `vi.mock();`,
    // unrelated object / method
    `jest.mock('./foo');`,
    `vi.stubEnv('./foo');`,
    // identifier callee
    `mock('./foo');`,
    // computed member callee property
    `vi[method]('./foo');`,
    // other extensions on vi helpers are accepted
    `vi.mock('./fixture.json');`,
  ],
  invalid: [
    {
      code: `import { foo } from './foo.js';`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `import { foo } from './foo.ts';`,
    },
    {
      code: `export { foo } from './foo.js';`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `export { foo } from './foo.ts';`,
    },
    {
      code: `export * from './foo.js';`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `export * from './foo.ts';`,
    },
    {
      code: `void import('./foo.js');`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `void import('./foo.ts');`,
    },
    {
      code: `import { foo } from '~/util/foo.js';`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `import { foo } from '~/util/foo.ts';`,
    },
    {
      // double quotes are preserved by the fixer
      code: `import { foo } from "./foo.js";`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `import { foo } from "./foo.ts";`,
    },
    {
      code: `vi.mock('./foo.js');`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `vi.mock('./foo.ts');`,
    },
    {
      code: `vi.doMock('~/util/foo.js');`,
      errors: [{ messageId: 'useTsExtension' }],
      output: `vi.doMock('~/util/foo.ts');`,
    },
    {
      code: `vi.mock('./foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      code: `vi.doMock('./foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      code: `vi.unmock('./foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      code: `vi.doUnmock('./foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      code: `void vi.importActual('./foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      code: `void vi.importMock('~/util/foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      // a trailing dot is not a valid extension
      code: `vi.mock('./foo.');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      // dotfiles have no extension
      code: `vi.mock('./.foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
    {
      // no slash in the specifier
      code: `vi.mock('~foo');`,
      errors: [{ messageId: 'missingExtension' }],
    },
  ],
});
