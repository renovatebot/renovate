import { RuleTester } from 'oxlint/plugins-dev';
import rule from './test-root-describe.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const cwd = '/repo';

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
  cwd,
});

ruleTester.run('test-root-describe', rule, {
  valid: [
    {
      code: `describe('util/foo', () => {});`,
      filename: '/repo/lib/util/foo.spec.ts',
    },
    {
      code: `describe('tools/bar', () => {});`,
      filename: '/repo/tools/bar.spec.ts',
    },
    // non-spec files are skipped entirely
    {
      code: `describe('anything', () => {});`,
      filename: '/repo/lib/util/foo.ts',
    },
    // nested describes are not checked
    {
      code: `describe('util/foo', () => { describe('inner', () => {}); });`,
      filename: '/repo/lib/util/foo.spec.ts',
    },
  ],
  invalid: [
    {
      code: `describe('wrong name', () => {});`,
      filename: '/repo/lib/util/foo.spec.ts',
      errors: [
        { message: "Test must be described by this string: 'util/foo'" },
      ],
      output: `describe('util/foo', () => {});`,
    },
    {
      code: `describe(\`util/foo\`, () => {});`,
      filename: '/repo/lib/util/foo.spec.ts',
      errors: [
        { message: "Test must be described by this string: 'util/foo'" },
      ],
      output: `describe('util/foo', () => {});`,
    },
    {
      code: `describe();`,
      filename: '/repo/lib/util/foo.spec.ts',
      errors: [{ message: 'Test root describe must have arguments' }],
    },
  ],
});
