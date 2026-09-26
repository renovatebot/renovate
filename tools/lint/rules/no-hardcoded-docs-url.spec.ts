import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-hardcoded-docs-url.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-hardcoded-docs-url', rule, {
  valid: [
    // unrelated string literals
    `const url = 'https://example.com/docs';`,
    // non-string literals
    `const answer = 42;`,
    `const flag = true;`,
    // http, not https
    `const url = 'http://docs.renovatebot.com';`,
    // unrelated template literals
    'const url = `https://example.com/${path}`;',
    // the documented replacement
    `const url = config.productLinks.documentation;`,
  ],
  invalid: [
    {
      code: `const url = 'https://docs.renovatebot.com';`,
      errors: [{ messageId: 'noHardcodedDocsUrl' }],
    },
    {
      code: `const url = 'https://docs.renovatebot.com/configuration-options/';`,
      errors: [{ messageId: 'noHardcodedDocsUrl' }],
    },
    {
      code: `const msg = 'See https://docs.renovatebot.com for details';`,
      errors: [{ messageId: 'noHardcodedDocsUrl' }],
    },
    {
      code: 'const url = `https://docs.renovatebot.com/${page}`;',
      errors: [{ messageId: 'noHardcodedDocsUrl' }],
    },
    {
      code: 'const url = `${prefix}https://docs.renovatebot.com/x`;',
      errors: [{ messageId: 'noHardcodedDocsUrl' }],
    },
  ],
});
