import { RuleTester } from 'oxlint/plugins-dev';
import rule from './zod-schema-naming.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('zod-schema-naming', rule, {
  valid: [
    // correctly named schema
    `import { z } from 'zod';\nconst Foo = z.string();`,
    `import { z } from 'zod/v4';\nconst Foo = z.object({});`,
    // inferred type shares the schema name
    `import { z } from 'zod';\nconst Foo = z.string();\ntype Foo = z.infer<typeof Foo>;`,
    // `Schema` suffix on something that is not a zod schema
    `const FooSchema = somethingElse();`,
    `const FooSchema = 42;`,
    // declarator without an initializer
    `import { z } from 'zod';\nlet Foo;`,
    // destructured declarator id
    `import { z } from 'zod';\nconst { Foo } = z.string();`,
    // derived schema without a `Schema` suffix
    `import { z } from 'zod';\nconst Foo = z.string();\nconst Bar = Foo.optional();`,
    // `zod` import without the `z` specifier leaves zodBinding unset
    `import { ZodType } from 'zod';\ntype Foo = z.infer<typeof Bar>;`,
    // helper import from an unrelated module
    `import { helper } from '../util';\nconst FooSchema = helper();`,
    // default import is not an ImportSpecifier
    `import z from 'zod';\nconst FooSchema = z.string();`,
    // type aliases that are not `z.infer<typeof X>`
    `import { z } from 'zod';\ntype Foo = string;`,
    `import { z } from 'zod';\ntype Foo = Bar;`,
    `import { z } from 'zod';\ntype Foo = other.infer<typeof Bar>;`,
    `import { z } from 'zod';\ntype Foo = z.output<typeof Bar>;`,
    `import { z } from 'zod';\ntype Foo = z.infer<string>;`,
    `import { z } from 'zod';\ntype Foo = z.infer<typeof a.b>;`,
    `import { z } from 'zod';\ntype Foo = z.infer;`,
  ],
  invalid: [
    {
      code: `import { z } from 'zod';\nconst FooSchema = z.string();`,
      errors: [{ messageId: 'noSchemaSuffix' }],
    },
    {
      code: `import { z as zod } from 'zod/v4';\nconst FooSchema = zod.object({});`,
      errors: [{ messageId: 'noSchemaSuffix' }],
    },
    // built from a schema-utils helper
    {
      code: `import { LooseArray } from '../../util/schema-utils';\nconst FooSchema = LooseArray(bar);`,
      errors: [{ messageId: 'noSchemaSuffix' }],
    },
    // derived from an already-known schema name
    {
      code: `import { z } from 'zod';\nconst Foo = z.string();\nconst BarSchema = Foo.optional();`,
      errors: [{ messageId: 'noSchemaSuffix' }],
    },
    // exported schema
    {
      code: `import { z } from 'zod';\nexport const FooSchema = z.string();`,
      errors: [{ messageId: 'noSchemaSuffix' }],
    },
    // inferred type name does not match its schema
    {
      code: `import { z } from 'zod';\nconst Foo = z.string();\ntype Bar = z.infer<typeof Foo>;`,
      errors: [{ messageId: 'mismatchedInferType' }],
    },
    {
      code: `import { z } from 'zod';\nconst Foo = z.string();\nexport type FooType = z.infer<typeof Foo>;`,
      errors: [{ messageId: 'mismatchedInferType' }],
    },
    // both problems at once
    {
      code: `import { z } from 'zod';\nconst FooSchema = z.string();\ntype Foo = z.infer<typeof FooSchema>;`,
      errors: [
        { messageId: 'noSchemaSuffix' },
        { messageId: 'mismatchedInferType' },
      ],
    },
  ],
});
