import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-strip-version-prefix.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-strip-version-prefix', rule, {
  valid: [
    // already using the helper
    `const v = stripVersionPrefix(x);`,
    // patterns that do more than remove the prefix
    `const v = x.replace(/^v\\??/, '');`,
    `const v = x.replace(regEx(/^v\\d+/), '');`,
    `const v = x.replace(/^OTP-/, '');`,
    `const v = x.replace(/v/, '');`,
    `const v = x.replace(/^v/g, '');`,
    `const v = x.replace(/^[vV]/i, '');`,
    // non-empty replacement
    `const v = x.replace(/^v/, 'V');`,
    `const v = x.replace(regEx(/^v/), '$1');`,
    // replacement is not a string literal
    `const v = x.replace(/^v/, empty);`,
    // pattern is not a regex literal
    `const v = x.replace('v', '');`,
    `const v = x.replace(pattern, '');`,
    `const v = x.replace(regEx('^v'), '');`,
    `const v = x.replace(regEx(/^v/, 'i'), '');`,
    `const v = x.replace(notRegEx(/^v/), '');`,
    // other methods and call shapes
    `const v = x.replaceAll(/^v/g, '');`,
    `const v = x[replace](/^v/, '');`,
    `const v = replace(/^v/, '');`,
    `const v = x.replace(/^v/);`,
    // prefix checks are untouched
    `const v = x.startsWith('v');`,
  ],
  invalid: [
    {
      code: `const v = x.replace(/^v/, '');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
    {
      code: `const v = x.replace(regEx(/^v/), '');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
    // optional chaining
    {
      code: `const v = x?.replace(regEx(/^v/), '');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
    // chained after another call
    {
      code: `const v = x.trim().replace(/^v/, '').split('-');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
    {
      code: `const v = x.replace(/^v/i, '');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
    {
      code: `const v = x.replace(regEx(/^v/i), '');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
    {
      code: `const v = x.replace(/^[vV]/, '');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
    {
      code: `const v = x.replace(regEx(/^[Vv]/), '');`,
      errors: [{ messageId: 'preferStripVersionPrefix' }],
    },
  ],
});
