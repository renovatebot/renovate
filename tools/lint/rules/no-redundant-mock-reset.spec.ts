import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-redundant-mock-reset.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-redundant-mock-reset', rule, {
  valid: [
    // outside any suite function
    `vi.resetAllMocks();`,
    // hooks that are not per-test
    `beforeAll(() => { vi.resetAllMocks(); });`,
    `afterAll(() => { vi.clearAllMocks(); });`,
    // inside a test body it may be intentional
    `it('works', () => { vi.resetAllMocks(); });`,
    `test('works', () => { foo.mockReset(); });`,
    // describe body is not a per-test hook
    `describe('suite', () => { vi.resetAllMocks(); });`,
    // not a member expression
    `beforeEach(() => { resetAllMocks(); });`,
    // computed member access is ignored
    `beforeEach(() => { vi['resetAllMocks'](); });`,
    // `resetAllMocks` is only redundant on `vi`
    `beforeEach(() => { other.resetAllMocks(); });`,
    // unrelated methods
    `beforeEach(() => { vi.mock('./foo'); });`,
    `beforeEach(() => { foo.mockReturnValue(1); });`,
  ],
  invalid: [
    {
      code: `beforeEach(() => { vi.resetAllMocks(); });`,
      errors: [{ messageId: 'redundantMockReset' }],
    },
    {
      code: `beforeEach(() => { vi.clearAllMocks(); });`,
      errors: [{ messageId: 'redundantMockReset' }],
    },
    {
      code: `afterEach(() => { vi.resetAllMocks(); });`,
      errors: [{ messageId: 'redundantMockReset' }],
    },
    {
      code: `beforeEach(() => { foo.mockReset(); });`,
      errors: [{ messageId: 'redundantMockReset' }],
    },
    {
      code: `afterEach(() => { foo.bar.mockClear(); });`,
      errors: [{ messageId: 'redundantMockReset' }],
    },
    // the innermost suite function decides: nested `beforeEach` inside `describe`
    {
      code: `describe('suite', () => { beforeEach(() => { vi.resetAllMocks(); }); });`,
      errors: [{ messageId: 'redundantMockReset' }],
    },
  ],
});
