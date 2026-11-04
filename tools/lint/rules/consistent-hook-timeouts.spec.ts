import { RuleTester } from 'oxlint/plugins-dev';
import rule from './consistent-hook-timeouts.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
  cwd: '/repo',
});

const filename = '/repo/lib/util/foo.spec.ts';

ruleTester.run('consistent-hook-timeouts', rule, {
  valid: [
    { code: `beforeAll(() => {}); afterAll(() => {});`, filename },
    {
      code: `beforeAll(() => {}, 30000); beforeEach(() => {}, 30000);`,
      filename,
    },
    { code: `beforeAll(() => {}, 30000);`, filename },
    // non-spec files are skipped
    {
      code: `beforeAll(() => {}, 30000); afterAll(() => {});`,
      filename: '/repo/lib/util/foo.ts',
    },
  ],
  invalid: [
    {
      code: `beforeAll(() => {}, 30000); afterAll(() => {}, 30000); beforeEach(() => {});`,
      filename,
      errors: [
        {
          message:
            'All hooks in a spec file must use the same timeout: `beforeEach` has no explicit timeout, but most hooks use 30000.',
        },
      ],
    },
    {
      code: `beforeAll(() => {}); beforeEach(() => {}); afterAll(() => {}, 5000);`,
      filename,
      errors: [
        {
          message:
            'All hooks in a spec file must use the same timeout: `afterAll` has 5000, but most hooks use no explicit timeout.',
        },
      ],
    },
  ],
});
