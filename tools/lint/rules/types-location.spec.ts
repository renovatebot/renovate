import path from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import rule from './types-location.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(import.meta.dirname, '../../..');

/** A logic file, where exported types are reported. */
const logicFile = path.join(repoRoot, 'lib/modules/manager/npm/npmrc.ts');

/** The file types are expected to live in. */
const typesFile = path.join(repoRoot, 'lib/modules/manager/npm/types.ts');

/** A file below a `types` directory, which is the same convention split up. */
const nestedTypesFile = path.join(repoRoot, 'lib/modules/foo/types/bar.ts');

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
  cwd: repoRoot,
});

ruleTester.run('types-location', rule, {
  valid: [
    // the types file itself collects them
    {
      code: `export interface Foo {\n  bar: string;\n}`,
      filename: typesFile,
    },
    {
      code: `export type Foo = string;`,
      filename: typesFile,
    },
    // and so does anything below a `types` directory
    {
      code: `export interface Foo {\n  bar: string;\n}`,
      filename: nestedTypesFile,
    },
    // file-local types are intentionally local
    {
      code: `interface Foo {\n  bar: string;\n}`,
      filename: logicFile,
    },
    {
      code: `type Foo = string;`,
      filename: logicFile,
    },
    // re-exports carry no declaration of their own
    {
      code: `export type { Foo } from './types.ts';`,
      filename: logicFile,
    },
    {
      code: `export type * from './types.ts';`,
      filename: logicFile,
    },
    {
      code: `import type { Foo } from './types.ts';\nexport type { Foo };`,
      filename: logicFile,
    },
    // values are not types
    {
      code: `export const foo = 42;`,
      filename: logicFile,
    },
    {
      code: `export function foo(): void {}`,
      filename: logicFile,
    },
    {
      code: `export enum Foo {\n  Bar,\n}`,
      filename: logicFile,
    },
    {
      code: `export class Foo {}`,
      filename: logicFile,
    },
  ],
  invalid: [
    {
      code: `export interface Foo {\n  bar: string;\n}`,
      filename: logicFile,
      errors: [{ messageId: 'moveToTypesFile' }],
    },
    {
      code: `export type Foo = string;`,
      filename: logicFile,
      errors: [{ messageId: 'moveToTypesFile' }],
    },
    // a file named `types.ts` outside `lib` is still gated on its own basename
    {
      code: `export type Foo = string;`,
      filename: path.join(repoRoot, 'lib/modules/manager/npm/mytypes.ts'),
      errors: [{ messageId: 'moveToTypesFile' }],
    },
    // several declarations in one file
    {
      code: `export type Foo = string;\nexport interface Bar {\n  baz: number;\n}`,
      filename: logicFile,
      errors: [
        { messageId: 'moveToTypesFile' },
        { messageId: 'moveToTypesFile' },
      ],
    },
  ],
});
