import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-fs-util.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-fs-util', rule, {
  valid: [
    // the scoped helpers themselves
    `import { readLocalFile } from '../util/fs';`,
    // unrelated modules
    `import { join } from 'node:path';`,
    `import fs from 'some-other-fs';`,
    // type-only imports don't touch the filesystem
    `import type { Stats } from 'fs';`,
    `import type { Stats } from 'node:fs';`,
    `import type { WriteStream } from 'fs-extra';`,
  ],
  invalid: [
    {
      code: `import fs from 'fs';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
    {
      code: `import fs from 'node:fs';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
    {
      code: `import { readFile } from 'fs/promises';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
    {
      code: `import { readFile } from 'node:fs/promises';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
    {
      code: `import fs from 'fs-extra';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
    {
      code: `import { outputFile } from 'fs-extra/esm';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
    // side-effect only import still loads the module
    {
      code: `import 'fs';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
    // a value import with an inline type specifier is still a value import
    {
      code: `import { type Stats, readFileSync } from 'fs';`,
      errors: [{ messageId: 'preferFsUtil' }],
    },
  ],
});
