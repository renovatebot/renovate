import { RuleTester } from 'oxlint/plugins-dev';
import rule from './codeblock-in-spec-fixtures.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('codeblock-in-spec-fixtures', rule, {
  valid: [
    // single-line templates
    'const x = `foo`;',
    'const x = `foo ${bar} baz`;',
    // multi-line value built from escapes, single source line
    'const x = `foo\\nbar`;',
    // tagged templates are fine
    'const x = codeBlock`foo\nbar`;',
    'const x = stripIndent`foo\nbar`;',
    'const x = html`foo\nbar`;',
    // test titles
    'describe(`foo\nbar`, () => {});',
    'it(`foo\nbar`, () => {});',
    'test(`foo\nbar`, () => {});',
    'suite(`foo\nbar`, () => {});',
    'bench(`foo\nbar`, () => {});',
    // chained / member title calls
    'it.only(`foo\nbar`, () => {});',
    'it.each(cases)(`foo\nbar`, () => {});',
    // inline snapshots are managed by vitest
    'expect(x).toMatchInlineSnapshot(`foo\nbar`);',
    'expect(fn).toThrowErrorMatchingInlineSnapshot(`foo\nbar`);',
    // leading whitespace would be lost by codeBlock's trim
    'const x = `\nfoo\nbar`;',
    // trailing whitespace would be lost by codeBlock's trim
    'const x = `foo\nbar\n`;',
    // every line indented: codeBlock cannot reproduce this
    'const x = `  foo\n  bar`;',
    // line continuation: multi-line source, single-line value
    'const x = `foo\\\nbar`;',
  ],
  invalid: [
    {
      code: 'const x = `foo\nbar`;',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      code: 'const x = `foo\n  bar\nbaz`;',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      // substitutions count as opaque non-whitespace placeholders
      code: 'const x = `${a}\n${b}`;',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      // not a title function
      code: 'render(`foo\nbar`);',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      // title functions only exempt the first argument
      code: 'it(`title`, `foo\nbar`);',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      // non-snapshot matcher
      code: 'expect(x).toBe(`foo\nbar`);',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      // computed matcher access
      code: 'expect(x)[matcher](`foo\nbar`);',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      // not an argument of the call, so not an inline snapshot
      code: 'expect(x).toMatchInlineSnapshot()(`foo\nbar`);',
      errors: [{ messageId: 'useCodeBlock' }],
    },
    {
      // no parent call expression
      code: 'const x = { fixture: `foo\nbar` };',
      errors: [{ messageId: 'useCodeBlock' }],
    },
  ],
});
