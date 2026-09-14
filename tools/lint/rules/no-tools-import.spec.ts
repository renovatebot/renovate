import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-tools-import.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-tools-import', rule, {
  valid: [
    `import { foo } from './foo.ts';`,
    `import { foo } from '../util/foo.ts';`,
    // `tools` without a trailing slash is not a directory import
    `import { foo } from './tools.ts';`,
    `import { foo } from 'some-tools';`,
    // does not start a path segment
    `import { foo } from 'mytools/foo.ts';`,
    // no source
    `export const foo = 1;`,
    `export { foo };`,
    // dynamic import with a non-literal source
    `const p = import('../' + name);`,
    `const p = import('./foo.ts');`,
  ],
  invalid: [
    {
      code: `import { foo } from 'tools/foo.ts';`,
      errors: [{ messageId: 'noToolsImport' }],
    },
    {
      code: `import { foo } from '../tools/foo.ts';`,
      errors: [{ messageId: 'noToolsImport' }],
    },
    {
      code: `import { foo } from '../../tools/lint/foo.ts';`,
      errors: [{ messageId: 'noToolsImport' }],
    },
    {
      code: `export { foo } from './tools/foo.ts';`,
      errors: [{ messageId: 'noToolsImport' }],
    },
    {
      code: `export * from '../tools/foo.ts';`,
      errors: [{ messageId: 'noToolsImport' }],
    },
    {
      code: `const p = import('../tools/foo.ts');`,
      errors: [{ messageId: 'noToolsImport' }],
    },
  ],
});
