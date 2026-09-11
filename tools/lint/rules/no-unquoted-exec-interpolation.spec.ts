import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-unquoted-exec-interpolation.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-unquoted-exec-interpolation', rule, {
  valid: [
    // not a command context
    'logger.debug(`installing ${depName}`);',
    'const message = `installing ${depName}`;',
    'const re = regEx(`^${depName}$`);',
    'function f() { return `npm i ${depName}`; }',
    'const list = deps.map((d) => `npm i ${d.depName}`);',
    // an explicit `return` stops at the enclosing block
    'const cmds = deps.map((d) => { return `npm i ${d.depName}`; });',
    'child.exec(`npm i ${depName}`);',
    // no interpolation at all
    'exec(`npm i`);',
    // interpolated value is not repository-controlled
    'exec(`npm i ${localVar}`);',
    'exec(`npm i ${1}`);',
    'exec(`npm i ${cfg.somethingElse}`);',
    // non-string derived fields cannot carry shell metacharacters
    'exec(`mod upgrade -t=${newMajor}`);',
    'exec(`echo ${isLockFileMaintenance}`);',
    // computed access reads no name
    "exec(`npm i ${dep['depName']}`);",
    // escaped with shlex
    'exec(`npm i ${quote(depName)}`);',
    'exec(`npm i ${shlex.quote(depName)}`);',
    'exec(`npm i ${join(deps)}`);',
    'exec(`npm i ${shlex.join(deps)}`);',
    "exec(`npm i ${deps.map(quote).join(' ')}`);",
    "exec(`npm i ${deps.filter(Boolean).map((d) => quote(d.depName)).join(' ')}`);",
    // a bare identifier receiver may already hold escaped elements
    "exec(`helm ${parameters.join(',')}`);",
    // the whole chain is not a command context
    "const list = deps.map((d) => `npm i ${d.depName}`).join(' ');",
    // no parent to inspect
    '`npm i ${depName}`;',
  ],
  invalid: [
    // `exec()` argument
    {
      code: 'exec(`npm i ${depName}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // command-shaped bindings
    {
      code: 'const cmd = `npm i ${depName}`;',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'const command = `npm i ${packageName}`;',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'const execArgs = `--token ${token}`;',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // assignment to a command-shaped target
    {
      code: 'cmd = `npm i ${depName}`;',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'opts.command = `npm i ${depName}`;',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // pushed onto a command array
    {
      code: 'commands.push(`npm i ${depName}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // array / conditional / logical / nested-template contexts
    {
      code: 'const cmd = [`npm i ${depName}`];',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'const cmd = flag ? `npm i ${depName}` : other;',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'const cmd = other ?? `npm i ${depName}`;',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'exec(`prefix ${`npm i ${depName}`}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // implicit arrow return whose chain ends in a command binding
    {
      code: 'const cmds = deps.map((d) => `npm i ${d.depName}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // wrappers are unwrapped
    {
      code: 'exec(`npm i ${dep?.depName}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'exec(`npm i ${dep!.depName}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'exec(`npm i ${depName as string}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // calls that neither escape nor launder their input are looked through
    {
      code: 'exec(`npm i ${String(depName)}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    {
      code: 'exec(`npm i ${token.trim()}`);',
      errors: [{ messageId: 'noUnquotedExecInterpolation' }],
    },
    // several untrusted names read by one call
    {
      code: 'exec(`npm i ${fn(depName, packageName)}`);',
      errors: [
        { messageId: 'noUnquotedExecInterpolation' },
        { messageId: 'noUnquotedExecInterpolation' },
      ],
    },
    // unescaped inline `join()`
    {
      code: "exec(`npm i ${deps.map((d) => d.depName).join(' ')}`);",
      errors: [{ messageId: 'noUnquotedJoin' }],
    },
    {
      code: "exec(`npm i ${[depName, packageName].join(' ')}`);",
      errors: [{ messageId: 'noUnquotedJoin' }],
    },
    // multiple interpolations in one command
    {
      code: 'const cmd = `npm i ${depName}@${newValue}`;',
      errors: [
        { messageId: 'noUnquotedExecInterpolation' },
        { messageId: 'noUnquotedExecInterpolation' },
      ],
    },
  ],
});
