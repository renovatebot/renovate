import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-versioning-helpers.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

const errors = [{ messageId: 'preferVersioningHelpers' }];

ruleTester.run('prefer-versioning-helpers', rule, {
  valid: [
    // a major version alone has no dotted number
    `regEx(/^\\d+$/);`,
    // a version extracted after a literal prefix
    `regEx(/^go\\s*(?<version>\\d+\\.\\d+)$/);`,
    `regEx(/^toolchain go(?<version>\\d+\\.\\d+\\.\\d+)$/);`,
    // a version extracted from a line of a file
    `regEx(/^(?<version>\\d+\\.\\d+\\.\\d+)$/m);`,
    `regEx('^\\\\d+\\\\.\\\\d+$', 'm');`,
    // not anchored at the start of the string
    `regEx(/(?<version>\\d+\\.\\d+\\.\\d+)/);`,
    `regEx(/\\d+\\.\\d+/);`,
    // a non-digit prefix before the number
    `regEx(/^(?<prefix>[^\\d]*)(?<major>\\d+)(?:\\.(?<minor>\\d+))?$/);`,
    // digits without a dot separator
    `regEx(/^\\d+-\\d+$/);`,
    // strings outside regEx() are not patterns
    `const extractVersion = '^\\\\d+\\\\.\\\\d+$';`,
    `other('^\\\\d+\\\\.\\\\d+$');`,
    `regEx(pattern);`,
  ],
  invalid: [
    { code: `regEx(/^\\d+\\.\\d+\\.\\d+$/);`, errors },
    { code: `regEx(/^\\d+\\.\\d+\\.\\d+/);`, errors },
    { code: `regEx(/^[0-9]+\\.[0-9]+$/);`, errors },
    { code: `regEx(/^v?\\d+(?:\\.\\d+)?$/);`, errors },
    { code: `regEx(/^v\\d+\\.\\d+\\.\\d+(?:$|-otp)/);`, errors },
    { code: `regEx(/^[vV]?\\d{1,3}\\.\\d+$/);`, errors },
    { code: `regEx(/^(?<major>\\d+)\\.(?<minor>\\d+)\\.\\d+$/);`, errors },
    {
      code: `regEx(/^v?(?<version>\\d+(?:\\.\\d+)*(?:\\+[0-9A-Za-z.+-]+)?)$/);`,
      errors,
    },
    { code: `const re = /^\\d+\\.\\d+$/;`, errors },
    { code: `regEx(/^\\d+\\.\\d+$/i);`, errors },
    { code: `regEx('^\\\\d+\\\\.\\\\d+$');`, errors },
    { code: `regEx('^v?\\\\d+\\\\.\\\\d+$', 'i');`, errors },
  ],
});
