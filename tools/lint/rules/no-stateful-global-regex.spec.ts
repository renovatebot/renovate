import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-stateful-global-regex.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-stateful-global-regex', rule, {
  valid: [
    // no stateful flag
    `const re = /a/;\nre.test(x);`,
    `const re = /a/i;\nre.exec(x);`,
    `const re = regEx('a');\nre.test(x);`,
    `const re = regEx('a', 'i');\nre.test(x);`,
    `const re = regEx(/a/);\nre.test(x);`,
    // flags argument is not a literal string
    `const re = regEx(pattern, flags);\nre.test(x);`,
    `const re = regEx(pattern, 1);\nre.test(x);`,
    // not a `regEx()` call
    `const re = other('a', 'g');\nre.test(x);`,
    `const re = someObject.regEx('a', 'g');\nre.test(x);`,
    // declared but never used with test()/exec()
    `const re = /a/g;\nx.replace(re, '');`,
    // used with a computed member call
    `const re = /a/g;\nre['test'](x);`,
    // not module scope
    `function f(x) {\n  const re = /a/g;\n  return re.test(x);\n}`,
    // destructuring declarator ids are ignored
    `const [re] = [/a/g];\nre.test(x);`,
    // no initializer
    `let re;\nre.test(x);`,
    // non-variable statements at module scope
    `export function f() {}\nre.test(x);`,
    // state must not leak between files: a declaration with no usage here...
    `const leaky = /a/g;`,
    // ...and a usage with no declaration here must both stay clean
    `leaky.test(x);`,
  ],
  invalid: [
    {
      code: `const re = /a/g;\nre.test(x);`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
    {
      code: `const re = /a/y;\nre.exec(x);`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
    {
      code: `let re = /a/g;\nre.test(x);`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
    {
      code: `export const re = /a/g;\nre.test(x);`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
    {
      code: `const re = regEx('a', 'g');\nre.exec(x);`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
    {
      code: `const re = regEx(/a/g);\nre.test(x);`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
    // usage may appear before the declaration in the file
    {
      code: `function f(x) {\n  return re.test(x);\n}\nconst re = /a/g;`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
    // one report per offending declaration
    {
      code: `const a = /a/g;\nconst b = /b/g;\na.test(x);\nb.exec(x);`,
      errors: [
        { messageId: 'noStatefulGlobalRegex' },
        { messageId: 'noStatefulGlobalRegex' },
      ],
    },
    // `leaky` again, to prove the previous file's state was reset
    {
      code: `const leaky = /a/g;\nleaky.test(x);`,
      errors: [{ messageId: 'noStatefulGlobalRegex' }],
    },
  ],
});
