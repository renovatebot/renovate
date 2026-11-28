import { codeBlock } from 'common-tags';
import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-get-option.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-get-option', rule, {
  valid: [
    `const option = getOption('versioning');`,
    // other methods on the config options are unaffected
    `const templated = getOptions().filter((o) => o.supportsTemplating);`,
    `const options = getOptions(); options.map((o) => o.name);`,
    // filtering on anything other than comparing the name
    `getOptions().filter((o) => o.globalOnly);`,
    `getOptions().filter((o) => o.name !== 'managerFilePatterns');`,
    `getOptions().filter((o) => !managers.has(o.name));`,
    `getOptions().filter((o) => other.name === 'foo');`,
    // `find()` on arrays which are not the config options
    `const options = getManagers(); options.find((o) => o.name === 'npm');`,
    `rules.find((r) => r.name === 'foo');`,
  ],
  invalid: [
    {
      code: `getOptions().find((o) => o.name === 'versioning');`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      code: `options.getOptions().find(({ name }) => name === 'versioning');`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      code: `const options = getOptions(); options.find((o) => o.name === 'versioning');`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      code: `const o = getOptions(); o.find(({ name }) => name === 'versioning');`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      code: `getOptions().filter((o) => o.name === 'versioning');`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      code: `const opts = getOptions(); opts.filter((o) => prop.property === o.name);`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      code: `getOptions().filter(({ name }) => name === 'versioning');`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      code: `getOptions().filter(({ name: optionName }) => optionName === 'versioning');`,
      errors: [{ messageId: 'preferGetOption' }],
    },
    {
      // the variable is declared after the function which uses it
      code: codeBlock`
        function lookup(name: string) {
          return opts.find((o) => o.name === name);
        }
        const opts = getOptions();
      `,
      errors: [{ messageId: 'preferGetOption' }],
    },
  ],
});
