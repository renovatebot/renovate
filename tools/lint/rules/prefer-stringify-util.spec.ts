import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-stringify-util.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-stringify-util', rule, {
  valid: [
    // already using the util helpers
    `safeStringify(value);`,
    `quickStringify(value);`,
    // other JSON methods are not checked
    `JSON.parse(value);`,
    // member callee is not the `JSON` global
    `foo.JSON.stringify(value);`,
    // computed member call
    `JSON['stringify'](value);`,
    // callee is not a member expression
    `stringify(value);`,
  ],
  invalid: [
    {
      code: `JSON.stringify(value);`,
      errors: [{ messageId: 'preferStringifyUtil' }],
    },
    {
      code: `JSON.stringify(value, null, 2);`,
      errors: [{ messageId: 'preferStringifyUtil' }],
    },
    {
      code: `const s = \`prefix-\${JSON.stringify(value)}\`;`,
      errors: [{ messageId: 'preferStringifyUtil' }],
    },
  ],
});
