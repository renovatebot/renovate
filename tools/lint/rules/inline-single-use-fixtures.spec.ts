import { RuleTester } from 'oxlint/plugins-dev';
import rule from './inline-single-use-fixtures.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

const filename = '/repo/lib/modules/manager/foo/extract.spec.ts';

ruleTester.run('inline-single-use-fixtures', rule, {
  valid: [
    // only spec files are checked
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", () => { use(fixture); });',
      filename: '/repo/lib/modules/manager/foo/extract.ts',
    },
    // single-line initializers are left alone
    {
      code: 'const fixture = codeBlock`foo`;\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = Fixtures.get("foo.json");\nit("a", () => { use(fixture); });',
      filename,
    },
    // used from two tests
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", () => { use(fixture); });\nit("b", () => { use(fixture); });',
      filename,
    },
    // used from zero tests
    {
      code: 'const fixture = codeBlock`\nfoo\n`;',
      filename,
    },
    // used outside a test callback
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nbeforeEach(() => { use(fixture); });\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\ndescribe("d", () => { use(fixture); it("a", () => { use(fixture); }); });',
      filename,
    },
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nfunction helper() { return fixture; }\nit("a", () => { use(helper()); });',
      filename,
    },
    // referenced in the test title, not the callback
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit(`parses ${fixture}`, () => { use(fixture); });',
      filename,
    },
    // referenced in an `it.each` table, not the callback
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit.each([fixture])("a", (input) => { use(input); });',
      filename,
    },
    // referenced as a non-function argument of the test call
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", fixture);',
      filename,
    },
    // not a relocation-safe initializer shape
    {
      code: 'const fixture = `\nfoo\n`;\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = html`\nfoo\n`;\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = {\n  foo: "bar",\n};\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = Fixtures.other(\n  "foo",\n);\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = Fixtures["get"](\n  "foo",\n);\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = Other.get(\n  "foo",\n);\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const fixture = load(\n  "foo",\n);\nit("a", () => { use(fixture); });',
      filename,
    },
    // not a plain single-identifier `const`
    {
      code: 'let fixture = codeBlock`\nfoo\n`;\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'const a = codeBlock`\nfoo\n`, b = 1;\nit("a", () => { use(a, b); });',
      filename,
    },
    {
      code: 'const { fixture } = codeBlock`\nfoo\n`;\nit("a", () => { use(fixture); });',
      filename,
    },
    {
      code: 'export const fixture = codeBlock`\nfoo\n`;\nit("a", () => { use(fixture); });',
      filename,
    },
    // declared inside a describe, not at module scope
    {
      code: 'describe("d", () => {\n  const fixture = codeBlock`\nfoo\n`;\n  it("a", () => { use(fixture); });\n});',
      filename,
    },
    // a shadowing local is not a reference to the module-scope binding
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", () => { const fixture = 1; use(fixture); });',
      filename,
    },
    // referenced by a non-test call with a function argument
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nvi.mock("./foo", () => ({ fixture }));',
      filename,
    },
    // referenced from a nested callback inside the test, plus a second test
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", () => { [1].map(() => use(fixture)); });\nit("b", () => { use(fixture); });',
      filename,
    },
    // test call reached through a computed member expression
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\n(it as any)("a", () => { use(fixture); });',
      filename,
    },
  ],
  invalid: [
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", () => { use(fixture); });',
      filename,
      errors: [
        {
          messageId: 'inlineSingleUseFixture',
          data: { name: 'fixture', testName: 'it' },
        },
      ],
    },
    {
      code: 'const fixture = stripIndent`\nfoo\n`;\ntest("a", () => { use(fixture); });',
      filename,
      errors: [
        {
          messageId: 'inlineSingleUseFixture',
          data: { name: 'fixture', testName: 'test' },
        },
      ],
    },
    {
      code: 'const fixture = Fixtures.get(\n  "foo.json",\n);\nit("a", () => { use(fixture); });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
    {
      code: 'const fixture = Fixtures.getJson(\n  "foo.json",\n);\nit("a", () => { use(fixture); });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
    // multiple references from the same test still count as a single use
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", () => { use(fixture); use(fixture); });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
    // nested callbacks inside the test body
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", async () => { await expect(async () => use(fixture)).resolves; });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
    // chained / member test calls
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit.only("a", () => { use(fixture); });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit.each([1])("a", () => { use(fixture); });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\ntest.failing.each([1])("a", () => { use(fixture); });',
      filename,
      errors: [
        {
          messageId: 'inlineSingleUseFixture',
          data: { name: 'fixture', testName: 'test' },
        },
      ],
    },
    // a `function` expression callback
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\nit("a", function () { use(fixture); });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
    // inside a describe block
    {
      code: 'const fixture = codeBlock`\nfoo\n`;\ndescribe("d", () => { it("a", () => { use(fixture); }); });',
      filename,
      errors: [{ messageId: 'inlineSingleUseFixture' }],
    },
  ],
});
