import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-exec-shell-option.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-exec-shell-option', rule, {
  valid: [
    // other option names
    `exec('ls', { cwd: '/tmp' });`,
    `const opts = { shellEscape: true };`,
    // destructuring is an ObjectPattern, not an ObjectExpression
    `const { shell } = opts;`,
    `function f({ shell }) {}`,
    // numeric keys have no string name
    `const opts = { 0: true };`,
    // string literal key with a different name
    `const opts = { 'cwd': '/tmp' };`,
  ],
  invalid: [
    {
      code: `exec('ls', { shell: true });`,
      errors: [{ messageId: 'noExecShellOption' }],
    },
    {
      code: `exec('ls', { shell: '/bin/bash' });`,
      errors: [{ messageId: 'noExecShellOption' }],
    },
    {
      code: `const opts = { 'shell': true };`,
      errors: [{ messageId: 'noExecShellOption' }],
    },
    {
      code: `const opts = { cwd: '/tmp', shell: true };`,
      errors: [{ messageId: 'noExecShellOption' }],
    },
    {
      code: `const opts = { nested: { shell: true } };`,
      errors: [{ messageId: 'noExecShellOption' }],
    },
  ],
});
