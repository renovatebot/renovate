import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-dev-dependency-import.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

// `vitest` is a real `devDependencies` entry; `commander` is a real
// `dependencies` entry. Both are read from this repo's package.json.
ruleTester.run('no-dev-dependency-import', rule, {
  valid: [
    // relative and absolute imports are never package imports
    `import { foo } from './foo.ts';`,
    `import { foo } from '/foo.ts';`,
    // a real production dependency
    `import { Command } from 'commander';`,
    // a devDependency is fine as a type-only import
    `import type { Something } from 'vitest';`,
    // a devDependency is fine when every specifier is type-only
    `import { type Something } from 'vitest';`,
    // a devDependency is fine as a type-only re-export
    `export type { Something } from 'vitest';`,
    `export { type Something } from 'vitest';`,
    // no source
    `export const foo = 1;`,
    `export { foo };`,
    // dynamic import with a non-literal source
    `const p = import('../' + name);`,
    // dynamic import with a non-string literal source
    `const p = import(42);`,
    // a devDependency is fine as a type-only `export *`
    `export type * from 'vitest';`,
  ],
  invalid: [
    {
      code: `import { describe } from 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    {
      code: `import vitest from 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    {
      code: `import * as vitest from 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    // side-effect only import is a runtime import
    {
      code: `import 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    // mixed type/value specifiers still produce a runtime import
    {
      code: `import { type Something, describe } from 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    // deep import from a devDependency
    {
      code: `import { describe } from 'vitest/dist/foo.js';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    // scoped devDependency
    {
      code: `import { something } from '@types/common-tags/foo.js';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    {
      code: `export { describe } from 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    {
      code: `export * from 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    // re-export with no specifiers is still a runtime import
    {
      code: `export {} from 'vitest';`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
    {
      code: `const p = import('vitest');`,
      errors: [{ messageId: 'noDevDependencyImport' }],
    },
  ],
});
