import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-stub-env.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-stub-env', rule, {
  valid: [
    // module scope: a stub here is reverted before the first test runs
    `process.env.CONTAINERBASE = 'true';`,
    `delete process.env.NPM_CONFIG_CACHE;`,
    // `beforeAll` / `afterAll` / `describe` bodies run once, same problem
    `beforeAll(() => { process.env.FOO = 'bar'; });`,
    `afterAll(() => { delete process.env.FOO; });`,
    `describe('suite', () => { process.env.FOO = 'bar'; });`,
    // reading is always fine
    `it('works', () => { expect(process.env.FOO).toBe('bar'); });`,
    `beforeEach(() => { const old = process.env.FOO; });`,
    // already migrated
    `beforeEach(() => { vi.stubEnv('FOO', 'bar'); });`,
    // a different object that merely looks similar
    `beforeEach(() => { other.env.FOO = 'bar'; });`,
    `beforeEach(() => { process.other.FOO = 'bar'; });`,
    // deleting something that is not a `process.env` member
    `beforeEach(() => { delete foo.bar; });`,
  ],
  invalid: [
    {
      code: `beforeEach(() => { process.env.FOO = 'bar'; });`,
      errors: [{ messageId: 'preferStubEnv' }],
      output: `beforeEach(() => { vi.stubEnv('FOO', 'bar'); });`,
    },
    {
      code: `afterEach(() => { delete process.env.FOO; });`,
      errors: [{ messageId: 'preferStubEnvDelete' }],
      output: `afterEach(() => { vi.stubEnv('FOO', undefined); });`,
    },
    {
      code: `it('works', () => { process.env.FOO = 'bar'; });`,
      errors: [{ messageId: 'preferStubEnv' }],
      output: `it('works', () => { vi.stubEnv('FOO', 'bar'); });`,
    },
    {
      code: `test('works', () => { delete process.env.FOO; });`,
      errors: [{ messageId: 'preferStubEnvDelete' }],
      output: `test('works', () => { vi.stubEnv('FOO', undefined); });`,
    },
    // the innermost suite function decides
    {
      code: `describe('suite', () => { beforeEach(() => { process.env.FOO = 'bar'; }); });`,
      errors: [{ messageId: 'preferStubEnv' }],
      output: `describe('suite', () => { beforeEach(() => { vi.stubEnv('FOO', 'bar'); }); });`,
    },
    // `it.only` / `it.each(...)` are recognised as test contexts
    {
      code: `it.only('works', () => { process.env.FOO = 'bar'; });`,
      errors: [{ messageId: 'preferStubEnv' }],
      output: `it.only('works', () => { vi.stubEnv('FOO', 'bar'); });`,
    },
    {
      code: `it.each([1])('works', () => { delete process.env.FOO; });`,
      errors: [{ messageId: 'preferStubEnvDelete' }],
      output: `it.each([1])('works', () => { vi.stubEnv('FOO', undefined); });`,
    },
    // computed access keeps the key expression verbatim
    {
      code: `beforeEach(() => { process.env['FOO'] = 'bar'; });`,
      errors: [{ messageId: 'preferStubEnv' }],
      output: `beforeEach(() => { vi.stubEnv('FOO', 'bar'); });`,
    },
    {
      code: `beforeEach(() => { envVars.forEach((key) => { delete process.env[key]; }); });`,
      errors: [{ messageId: 'preferStubEnvDelete' }],
      output: `beforeEach(() => { envVars.forEach((key) => { vi.stubEnv(key, undefined); }); });`,
    },
    // the assigned value is carried over verbatim
    {
      code: `beforeEach(() => { process.env.FOO = upath.join(dir, 'x'); });`,
      errors: [{ messageId: 'preferStubEnv' }],
      output: `beforeEach(() => { vi.stubEnv('FOO', upath.join(dir, 'x')); });`,
    },
    // compound assignment has no direct stub equivalent, so it is not fixed
    {
      code: `beforeEach(() => { process.env.PATH += ':/x'; });`,
      errors: [{ messageId: 'preferStubEnv' }],
    },
    // used as an expression rather than a statement, so it is not fixed
    {
      code: `it('works', () => { const v = (process.env.FOO = 'bar'); });`,
      errors: [{ messageId: 'preferStubEnv' }],
    },
    // replacing the whole object is reported anywhere, and never fixed
    {
      code: `const OLD_ENV = process.env; beforeEach(() => { process.env = { ...OLD_ENV }; });`,
      errors: [{ messageId: 'noProcessEnvReassign' }],
    },
    {
      code: `beforeAll(() => { process.env = {}; });`,
      errors: [{ messageId: 'noProcessEnvReassign' }],
    },
    {
      code: `process.env = {};`,
      errors: [{ messageId: 'noProcessEnvReassign' }],
    },
  ],
});
