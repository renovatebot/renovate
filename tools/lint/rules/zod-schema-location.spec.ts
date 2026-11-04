import path from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import rule from './zod-schema-location.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(import.meta.dirname, '../../..');

/** A real directory of this repo that contains a `schema.ts` file. */
const gatedFile = path.join(repoRoot, 'lib/config/some-logic.ts');

/** A real directory of this repo that has no `schema.ts` file. */
const skippedFile = path.join(repoRoot, 'lib/logger/some-logic.ts');

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
  cwd: repoRoot,
});

ruleTester.run('zod-schema-location', rule, {
  valid: [
    // directories without a colocated schema.ts are left alone
    {
      code: `import { z } from 'zod';\nexport const Foo = z.string();`,
      filename: skippedFile,
    },
    // no zod import at all
    {
      code: `export const Foo = bar();`,
      filename: gatedFile,
    },
    // non-exported schemas are exempt
    {
      code: `import { z } from 'zod';\nconst Foo = z.string();`,
      filename: gatedFile,
    },
    // exported value that is not built from zod
    {
      code: `import { z } from 'zod';\nexport const Foo = other.thing();`,
      filename: gatedFile,
    },
    // exported declaration that is not a variable declaration
    {
      code: `import { z } from 'zod';\nexport function foo() {}`,
      filename: gatedFile,
    },
    // re-export without a declaration
    {
      code: `import { z } from 'zod';\nexport { z };`,
      filename: gatedFile,
    },
    // declarator without an initializer
    {
      code: `import { z } from 'zod';\nexport let Foo;`,
      filename: gatedFile,
    },
    // destructured export id is not an Identifier
    {
      code: `import { z } from 'zod';\nexport const { Foo } = z.string();`,
      filename: gatedFile,
    },
    // `zod` import without the `z` specifier leaves zodBinding unset
    {
      code: `import { ZodType } from 'zod';\nexport const Foo = ZodType.create();`,
      filename: gatedFile,
    },
    // default import from zod is not an ImportSpecifier
    {
      code: `import z from 'zod';\nexport const Foo = z.string();`,
      filename: gatedFile,
    },
    // imports from unrelated modules are ignored
    {
      code: `import { helper } from '../util';\nexport const Foo = helper();`,
      filename: gatedFile,
    },
    // literal init has no leftmost identifier
    {
      code: `import { z } from 'zod';\nexport const Foo = 42;`,
      filename: gatedFile,
    },
  ],
  invalid: [
    {
      code: `import { z } from 'zod';\nexport const Foo = z.string();`,
      filename: gatedFile,
      errors: [{ messageId: 'moveToSchemaFile' }],
    },
    {
      code: `import { z } from 'zod/v4';\nexport const Foo = z.object({}).transform(fn);`,
      filename: gatedFile,
      errors: [{ messageId: 'moveToSchemaFile' }],
    },
    // aliased zod binding
    {
      code: `import { z as zod } from 'zod';\nexport const Foo = zod.string();`,
      filename: gatedFile,
      errors: [{ messageId: 'moveToSchemaFile' }],
    },
    // schema-utils helpers also produce schemas
    {
      code: `import { LooseArray } from '../../util/schema-utils';\nexport const Foo = LooseArray(bar);`,
      filename: gatedFile,
      errors: [{ messageId: 'moveToSchemaFile' }],
    },
    // several declarators in one export
    {
      code: `import { z } from 'zod';\nexport const Foo = z.string(), Bar = z.number();`,
      filename: gatedFile,
      errors: [
        { messageId: 'moveToSchemaFile' },
        { messageId: 'moveToSchemaFile' },
      ],
    },
  ],
});
