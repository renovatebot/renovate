import { RuleTester } from 'oxlint/plugins-dev';
import rule from './require-regex-util.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const libFile = '/repo/lib/util/example.ts';

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
  cwd: '/repo',
});

ruleTester.run('require-regex-util', rule, {
  valid: [
    // outside lib/ the rule is skipped entirely
    {
      code: `const re = /foo/; const re2 = new RegExp('foo');`,
      filename: '/repo/tools/example.ts',
    },
    // the regEx() implementation itself is exempt
    {
      code: `const re = new RegExp('foo');`,
      filename: '/repo/lib/util/regex.ts',
    },
    // regex literals wrapped in regEx() are allowed
    {
      code: `const re = regEx(/foo/);`,
      filename: libFile,
    },
    {
      code: `const re = regEx('foo');`,
      filename: libFile,
    },
    // not a RegExp constructor
    {
      code: `const re = new URL('https://example.com');`,
      filename: libFile,
    },
    // non-regex literals are untouched
    {
      code: `const s = 'foo'; const n = 1;`,
      filename: libFile,
    },
    // regEx() without arguments
    {
      code: `const re = regEx();`,
      filename: libFile,
    },
  ],
  invalid: [
    {
      code: `const re = new RegExp('foo');`,
      filename: libFile,
      errors: [{ messageId: 'requireRegexUtil' }],
    },
    {
      code: `const re = /foo/;`,
      filename: libFile,
      errors: [{ messageId: 'requireRegexUtil' }],
    },
    // only the first argument of regEx() is exempted
    {
      code: `const re = regEx('foo', /bar/);`,
      filename: libFile,
      errors: [{ messageId: 'requireRegexUtil' }],
    },
    // a different callee does not exempt the literal
    {
      code: `const re = notRegEx(/foo/);`,
      filename: libFile,
      errors: [{ messageId: 'requireRegexUtil' }],
    },
    {
      code: `const re = new RegExp(/foo/);`,
      filename: libFile,
      errors: [
        { messageId: 'requireRegexUtil' },
        { messageId: 'requireRegexUtil' },
      ],
    },
  ],
});
